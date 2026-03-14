-- Migration: Add staff_config jsonb to user_invites (Edit Staff parity: roles, pay, contact, hours)
-- Run with: npm run db:migrate:user-invites-staff-config

ALTER TABLE user_invites ADD COLUMN IF NOT EXISTS staff_config jsonb;
