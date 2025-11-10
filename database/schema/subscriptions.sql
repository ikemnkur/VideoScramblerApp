-- Subscriptions Table
-- Stores user subscription information for recurring payments

CREATE TABLE IF NOT EXISTS subscriptions (
    -- Primary key
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- User reference
    user_id BIGINT NOT NULL,
    
    -- Stripe references
    stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255) NOT NULL,
    
    -- Plan information
    plan_id VARCHAR(50) NOT NULL,                -- 'basic', 'pro', 'enterprise'
    plan_name VARCHAR(100) NOT NULL,             -- Display name
    
    -- Subscription status
    status VARCHAR(50) NOT NULL,                 -- 'active', 'canceled', 'past_due', 'trialing', 'canceling'
    
    -- Billing period
    current_period_start TIMESTAMP NULL,
    current_period_end TIMESTAMP NULL,
    
    -- Cancellation
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP NULL,
    
    -- Trial
    trial_start TIMESTAMP NULL,
    trial_end TIMESTAMP NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_stripe_subscription_id (stripe_subscription_id),
    INDEX idx_stripe_customer_id (stripe_customer_id),
    INDEX idx_status (status),
    INDEX idx_user_status (user_id, status),
    
    -- Unique constraint
    UNIQUE KEY unique_user_subscription (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subscription history table (for audit trail)
CREATE TABLE IF NOT EXISTS subscription_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subscription_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL,             -- 'created', 'updated', 'canceled', 'renewed'
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    
    -- Billing details
    amount DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Metadata
    event_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_subscription_id (subscription_id),
    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- View for active subscriptions
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT 
    s.id,
    s.user_id,
    s.stripe_subscription_id,
    s.stripe_customer_id,
    s.plan_id,
    s.plan_name,
    s.status,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    DATEDIFF(s.current_period_end, NOW()) as days_until_renewal,
    CASE 
        WHEN s.current_period_end < NOW() THEN 'expired'
        WHEN DATEDIFF(s.current_period_end, NOW()) <= 7 THEN 'expiring_soon'
        WHEN s.cancel_at_period_end = TRUE THEN 'canceling'
        ELSE 'active'
    END as subscription_health
FROM subscriptions s
WHERE s.status IN ('active', 'trialing', 'canceling');

-- Stored procedure to get user subscription with details
DELIMITER $$

DROP PROCEDURE IF EXISTS get_user_subscription$$

CREATE PROCEDURE get_user_subscription(
    IN p_user_id BIGINT
)
BEGIN
    SELECT 
        s.*,
        DATEDIFF(s.current_period_end, NOW()) as days_remaining,
        CASE 
            WHEN s.status = 'active' AND s.current_period_end > NOW() THEN TRUE
            ELSE FALSE
        END as has_active_subscription
    FROM subscriptions s
    WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing', 'canceling')
    ORDER BY s.created_at DESC
    LIMIT 1;
END$$

-- Stored procedure to log subscription event
DROP PROCEDURE IF EXISTS log_subscription_event$$

CREATE PROCEDURE log_subscription_event(
    IN p_subscription_id BIGINT,
    IN p_user_id BIGINT,
    IN p_event_type VARCHAR(50),
    IN p_old_status VARCHAR(50),
    IN p_new_status VARCHAR(50),
    IN p_amount DECIMAL(10, 2),
    IN p_currency VARCHAR(3),
    IN p_event_data JSON
)
BEGIN
    INSERT INTO subscription_history (
        subscription_id,
        user_id,
        event_type,
        old_status,
        new_status,
        amount,
        currency,
        event_data
    ) VALUES (
        p_subscription_id,
        p_user_id,
        p_event_type,
        p_old_status,
        p_new_status,
        p_amount,
        p_currency,
        p_event_data
    );
END$$

-- Stored procedure to check subscription validity
DROP PROCEDURE IF EXISTS check_subscription_valid$$

CREATE PROCEDURE check_subscription_valid(
    IN p_user_id BIGINT
)
BEGIN
    SELECT 
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM subscriptions 
                WHERE user_id = p_user_id 
                AND status IN ('active', 'trialing')
                AND current_period_end > NOW()
            ) THEN TRUE
            ELSE FALSE
        END as is_valid,
        (
            SELECT plan_id FROM subscriptions
            WHERE user_id = p_user_id
            AND status IN ('active', 'trialing')
            AND current_period_end > NOW()
            LIMIT 1
        ) as plan_id;
END$$

DELIMITER ;

-- Sample queries for common operations:

-- Get all active subscriptions
-- SELECT * FROM active_subscriptions;

-- Get user's subscription details
-- CALL get_user_subscription(123);

-- Check if user has valid subscription
-- CALL check_subscription_valid(123);

-- Get subscriptions expiring in the next 7 days
-- SELECT * FROM active_subscriptions WHERE days_until_renewal <= 7;

-- Get subscription history for a user
-- SELECT * FROM subscription_history WHERE user_id = 123 ORDER BY created_at DESC;

-- Get revenue by plan
-- SELECT 
--     plan_id, 
--     plan_name, 
--     COUNT(*) as subscriber_count,
--     SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
-- FROM subscriptions 
-- GROUP BY plan_id, plan_name;
