-- Migration: Add icon column to activities table
-- Run with: psql $DATABASE_URL -f migrations/006_activities_icon.sql

ALTER TABLE activities ADD COLUMN IF NOT EXISTS icon varchar(50);
