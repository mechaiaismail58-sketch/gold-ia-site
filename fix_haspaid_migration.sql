-- Run this in Supabase Dashboard → SQL Editor
-- Adds has_paid column to the users table if it doesn't exist

ALTER TABLE users ADD COLUMN IF NOT EXISTS has_paid boolean DEFAULT false;

-- Verify: check current state of the column
SELECT id, email, has_paid FROM users ORDER BY created_at DESC LIMIT 10;
