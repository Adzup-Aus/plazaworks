-- Migration: Invoice/quote/job numbering — 6 digits, no year, empty prefixes by default
-- Run with: psql $DATABASE_URL -f migrations/005_invoice_quote_numbering_6digits.sql

-- 1. app_counters: default pad_length to 6
ALTER TABLE app_counters ALTER COLUMN pad_length SET DEFAULT 6;
UPDATE app_counters SET pad_length = 6 WHERE pad_length <> 6;

-- 2. app_settings: default invoice and job prefixes to empty
ALTER TABLE app_settings ALTER COLUMN invoice_number_prefix SET DEFAULT '';
ALTER TABLE app_settings ALTER COLUMN job_number_prefix SET DEFAULT '';
UPDATE app_settings SET invoice_number_prefix = '' WHERE invoice_number_prefix = 'INV-';
UPDATE app_settings SET job_number_prefix = '' WHERE job_number_prefix = 'J-';
