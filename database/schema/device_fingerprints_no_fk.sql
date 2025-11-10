-- Device Fingerprints Table (No Foreign Key Version)
-- Stores device fingerprints for leak prevention and security tracking
-- This version works without foreign key constraints for maximum compatibility

CREATE TABLE IF NOT EXISTS device_fingerprints (
    -- Primary key
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- User reference (no foreign key constraint - more flexible)
    user_id BIGINT NOT NULL,
    
    -- Fingerprint identifiers
    fingerprint_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of the fingerprint
    short_hash VARCHAR(16) NOT NULL,         -- First 16 chars for quick lookup
    
    -- Device information (for display/filtering)
    device_type VARCHAR(50),                 -- 'Desktop', 'Mobile', 'Tablet'
    browser VARCHAR(100),                    -- 'Chrome 120.0', 'Firefox 115.0'
    os VARCHAR(100),                         -- 'Windows', 'MacOS', 'Linux', 'Android', 'iOS'
    screen_resolution VARCHAR(50),           -- '1920x1080'
    timezone VARCHAR(100),                   -- 'America/New_York'
    language VARCHAR(50),                    -- 'en-US'
    
    -- Network information
    ip_address VARCHAR(45),                  -- IPv4 or IPv6 address
    
    -- Full fingerprint data (JSON)
    full_fingerprint JSON,                   -- Complete fingerprint object for forensics
    compact_fingerprint JSON,                -- Compact version for embedding
    
    -- Tracking information
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    login_count INT DEFAULT 1,               -- Number of times this device logged in
    
    -- Trust/Security flags
    is_trusted BOOLEAN DEFAULT TRUE,         -- Manually mark as trusted/untrusted
    is_blocked BOOLEAN DEFAULT FALSE,        -- Block this device from logging in
    block_reason VARCHAR(255),               -- Reason for blocking (if blocked)
    
    -- Leak tracking
    unscramble_count INT DEFAULT 0,          -- Number of times this device unscrambled content
    last_unscramble TIMESTAMP NULL,          -- Last time content was unscrambled
    leaked_content_count INT DEFAULT 0,      -- Number of times content from this device was leaked
    
    -- Metadata
    user_agent TEXT,                         -- Full user agent string
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_user_id (user_id),
    INDEX idx_fingerprint_hash (fingerprint_hash),
    INDEX idx_short_hash (short_hash),
    INDEX idx_user_hash (user_id, fingerprint_hash),
    INDEX idx_last_seen (last_seen),
    INDEX idx_is_blocked (is_blocked),
    
    -- Unique constraint to prevent duplicate fingerprints per user
    UNIQUE KEY unique_user_fingerprint (user_id, fingerprint_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create a view for easy querying
CREATE OR REPLACE VIEW device_fingerprints_summary AS
SELECT 
    df.id,
    df.user_id,
    df.fingerprint_hash,
    df.short_hash,
    df.device_type,
    df.browser,
    df.os,
    df.screen_resolution,
    df.ip_address,
    df.first_seen,
    df.last_seen,
    df.login_count,
    df.unscramble_count,
    df.leaked_content_count,
    df.is_trusted,
    df.is_blocked,
    df.block_reason,
    TIMESTAMPDIFF(SECOND, df.first_seen, df.last_seen) as device_age_seconds,
    CASE 
        WHEN df.last_seen > DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 'active'
        WHEN df.last_seen > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 'recent'
        WHEN df.last_seen > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'inactive'
        ELSE 'dormant'
    END as device_status
FROM device_fingerprints df;

-- Stored procedure to save or update fingerprint
DELIMITER $$

DROP PROCEDURE IF EXISTS save_device_fingerprint$$

CREATE PROCEDURE save_device_fingerprint(
    IN p_user_id BIGINT,
    IN p_fingerprint_hash VARCHAR(64),
    IN p_short_hash VARCHAR(16),
    IN p_device_type VARCHAR(50),
    IN p_browser VARCHAR(100),
    IN p_os VARCHAR(100),
    IN p_screen_resolution VARCHAR(50),
    IN p_timezone VARCHAR(100),
    IN p_language VARCHAR(50),
    IN p_ip_address VARCHAR(45),
    IN p_full_fingerprint JSON,
    IN p_compact_fingerprint JSON,
    IN p_user_agent TEXT
)
BEGIN
    -- Check if this fingerprint already exists for this user
    IF EXISTS (
        SELECT 1 FROM device_fingerprints 
        WHERE user_id = p_user_id AND fingerprint_hash = p_fingerprint_hash
    ) THEN
        -- Update existing record
        UPDATE device_fingerprints
        SET 
            last_seen = CURRENT_TIMESTAMP,
            login_count = login_count + 1,
            ip_address = p_ip_address,  -- Update IP in case it changed
            full_fingerprint = p_full_fingerprint,
            compact_fingerprint = p_compact_fingerprint,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = p_user_id AND fingerprint_hash = p_fingerprint_hash;
        
        -- Return the updated record
        SELECT * FROM device_fingerprints 
        WHERE user_id = p_user_id AND fingerprint_hash = p_fingerprint_hash;
    ELSE
        -- Insert new record
        INSERT INTO device_fingerprints (
            user_id,
            fingerprint_hash,
            short_hash,
            device_type,
            browser,
            os,
            screen_resolution,
            timezone,
            language,
            ip_address,
            full_fingerprint,
            compact_fingerprint,
            user_agent
        ) VALUES (
            p_user_id,
            p_fingerprint_hash,
            p_short_hash,
            p_device_type,
            p_browser,
            p_os,
            p_screen_resolution,
            p_timezone,
            p_language,
            p_ip_address,
            p_full_fingerprint,
            p_compact_fingerprint,
            p_user_agent
        );
        
        -- Return the new record
        SELECT * FROM device_fingerprints WHERE id = LAST_INSERT_ID();
    END IF;
END$$

-- Stored procedure to increment unscramble count
DROP PROCEDURE IF EXISTS increment_unscramble_count$$

CREATE PROCEDURE increment_unscramble_count(
    IN p_fingerprint_hash VARCHAR(64)
)
BEGIN
    UPDATE device_fingerprints
    SET 
        unscramble_count = unscramble_count + 1,
        last_unscramble = CURRENT_TIMESTAMP
    WHERE fingerprint_hash = p_fingerprint_hash;
END$$

-- Stored procedure to mark device as leaked
DROP PROCEDURE IF EXISTS mark_device_leaked$$

CREATE PROCEDURE mark_device_leaked(
    IN p_fingerprint_hash VARCHAR(64),
    IN p_reason VARCHAR(255)
)
BEGIN
    UPDATE device_fingerprints
    SET 
        leaked_content_count = leaked_content_count + 1,
        is_trusted = FALSE,
        is_blocked = TRUE,
        block_reason = p_reason
    WHERE fingerprint_hash = p_fingerprint_hash;
END$$

DELIMITER ;

-- Sample queries for common operations:

-- Get all devices for a user
-- SELECT * FROM device_fingerprints WHERE user_id = 123 ORDER BY last_seen DESC;

-- Get device summary for a user
-- SELECT * FROM device_fingerprints_summary WHERE user_id = 123;

-- Find suspicious devices (multiple users with same fingerprint)
-- SELECT fingerprint_hash, COUNT(DISTINCT user_id) as user_count 
-- FROM device_fingerprints 
-- GROUP BY fingerprint_hash 
-- HAVING user_count > 1;

-- Find devices that leaked content
-- SELECT * FROM device_fingerprints WHERE leaked_content_count > 0;

-- Get most active devices
-- SELECT * FROM device_fingerprints ORDER BY login_count DESC LIMIT 10;

-- Find new devices (first login within last 24 hours)
-- SELECT * FROM device_fingerprints WHERE first_seen > DATE_SUB(NOW(), INTERVAL 1 DAY);
