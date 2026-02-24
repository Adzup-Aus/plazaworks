-- Migration: Remove multi-organization support (single-tenant)
-- Run with: psql $DATABASE_URL -f migrations/003_remove_multi_org.sql
-- Or: node -r dotenv/config scripts/run-migration.js migrations/003_remove_multi_org.sql

-- 1. Create app_settings if not exists
CREATE TABLE IF NOT EXISTS app_settings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name varchar(255) NOT NULL DEFAULT 'My Company',
  company_address text,
  company_phone varchar(50),
  company_email varchar(255),
  company_website varchar(255),
  timezone varchar(50) DEFAULT 'Australia/Brisbane',
  auto_convert_approved_quotes boolean NOT NULL DEFAULT true,
  auto_create_job_from_invoice boolean NOT NULL DEFAULT true,
  default_tax_rate decimal(5,2) DEFAULT '10',
  default_payment_terms_days integer DEFAULT 14,
  quote_number_prefix varchar(10) DEFAULT 'Q-',
  invoice_number_prefix varchar(10) DEFAULT 'INV-',
  job_number_prefix varchar(10) DEFAULT 'J-',
  default_quote_terms text,
  default_invoice_terms text,
  features_enabled text[] DEFAULT ARRAY['jobs', 'schedule', 'quotes', 'invoices', 'time_tracking', 'vehicles', 'checklists', 'kpi', 'backcosting']::text[],
  max_users integer,
  max_jobs_per_month integer,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 2. Create app_counters if not exists
CREATE TABLE IF NOT EXISTS app_counters (
  counter_key varchar(64) PRIMARY KEY,
  next_value integer NOT NULL DEFAULT 2,
  pad_length integer NOT NULL DEFAULT 4,
  updated_at timestamp DEFAULT now()
);

-- 3. Drop organization_id from tables (idempotent)
ALTER TABLE clients DROP COLUMN IF EXISTS organization_id;
ALTER TABLE quotes DROP COLUMN IF EXISTS organization_id;
ALTER TABLE invoices DROP COLUMN IF EXISTS organization_id;
ALTER TABLE vehicles DROP COLUMN IF EXISTS organization_id;
ALTER TABLE checklist_templates DROP COLUMN IF EXISTS organization_id;
ALTER TABLE terms_templates DROP COLUMN IF EXISTS organization_id;
ALTER TABLE jobs DROP COLUMN IF EXISTS organization_id;
ALTER TABLE staff_profiles DROP COLUMN IF EXISTS organization_id;
ALTER TABLE activities DROP COLUMN IF EXISTS organization_id;

-- 4. Drop organization-related tables (optional; uncomment when ready)
-- DROP TABLE IF EXISTS organization_invites CASCADE;
-- DROP TABLE IF EXISTS organization_members CASCADE;
-- DROP TABLE IF EXISTS organization_counters CASCADE;
-- DROP TABLE IF EXISTS organization_settings CASCADE;
-- DROP TABLE IF EXISTS organization_subscriptions CASCADE;
-- DROP TABLE IF EXISTS organizations CASCADE;
