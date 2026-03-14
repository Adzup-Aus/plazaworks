-- Migration: Add first_name, last_name, profile_image_url to user_invites (admin-configured user info)
-- Run with: npx tsx scripts/run-migration.ts migrations/008_user_invites_admin_fields.sql
-- Or: npm run db:push (from drizzle schema)

ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS first_name varchar(255);
ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS last_name varchar(255);
ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS profile_image_url varchar(1024);
