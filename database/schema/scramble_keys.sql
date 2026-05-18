-- scrambleKeys table
-- Tracks all scramble keys created by users (video, photo, audio)
-- Enforces usage limits (max_uses) and time-based expiry (expires_at)

CREATE TABLE IF NOT EXISTS `scrambleKeys` (
  `id`             BIGINT NOT NULL AUTO_INCREMENT,
  `key_id`         VARCHAR(64) NOT NULL,          -- UUID embedded in the key
  `owner_id`       VARCHAR(10) NOT NULL,           -- userData.id (varchar)
  `owner_username` VARCHAR(30) DEFAULT NULL,
  `media_type`     VARCHAR(20) NOT NULL DEFAULT 'video',  -- video | photo | audio
  `algorithm`      VARCHAR(50) DEFAULT NULL,
  `max_uses`       INT DEFAULT NULL,               -- NULL = unlimited
  `use_count`      INT NOT NULL DEFAULT 0,
  `expires_at`     TIMESTAMP NULL DEFAULT NULL,    -- NULL = never expires
  `created_at`     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `revoked`        TINYINT(1) NOT NULL DEFAULT 0,  -- 1 = manually revoked
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_key_id` (`key_id`),
  KEY `idx_owner_id` (`owner_id`),
  KEY `idx_owner_username` (`owner_username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
