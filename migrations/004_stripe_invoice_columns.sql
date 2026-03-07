-- Migration: Add Stripe payment link columns to invoices
-- Run with: psql $DATABASE_URL -f migrations/004_stripe_invoice_columns.sql

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id varchar(255),
  ADD COLUMN IF NOT EXISTS stripe_payment_link_url varchar(512);
