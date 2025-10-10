-- Add is_initial_password field to users table
-- This migration adds a new field to track whether a user is using an initial password set by an administrator

-- For SQLite
ALTER TABLE users ADD COLUMN is_initial_password INTEGER DEFAULT 0;

-- For MySQL (uncomment if using MySQL)
-- ALTER TABLE users ADD COLUMN is_initial_password BOOLEAN DEFAULT FALSE;

-- For PostgreSQL (uncomment if using PostgreSQL)
-- ALTER TABLE users ADD COLUMN is_initial_password BOOLEAN DEFAULT FALSE;

-- Update existing users to have is_initial_password = false
UPDATE users SET is_initial_password = 0 WHERE is_initial_password IS NULL;

