-- Add password reset fields to userData table
-- Run this SQL script in your MySQL database

ALTER TABLE userData
ADD COLUMN resetCode VARCHAR(6) DEFAULT NULL,
ADD COLUMN resetCodeExpiry DATETIME DEFAULT NULL;

-- Create index for faster lookups
CREATE INDEX idx_reset_code ON userData(resetCode, resetCodeExpiry);
