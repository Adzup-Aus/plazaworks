-- Migration: QuickBooks integration tables (009-quickbooks-integration)
-- Run with: psql $DATABASE_URL -f migrations/007_quickbooks_tables.sql

CREATE TABLE IF NOT EXISTS quickbooks_connections (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  encrypted_client_id text,
  encrypted_client_secret text,
  encrypted_access_token text,
  encrypted_refresh_token text,
  realm_id varchar(64),
  token_expires_at timestamp,
  enabled_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quickbooks_customer_mappings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  quickbooks_connection_id varchar(255) NOT NULL REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  platform_client_id varchar(255) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  quickbooks_customer_id varchar(64) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(quickbooks_connection_id, platform_client_id)
);

CREATE INDEX IF NOT EXISTS idx_qb_customer_mapping_conn ON quickbooks_customer_mappings(quickbooks_connection_id);

CREATE TABLE IF NOT EXISTS quickbooks_invoice_mappings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  quickbooks_connection_id varchar(255) NOT NULL REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  platform_invoice_id varchar(255) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  quickbooks_invoice_id varchar(64) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(quickbooks_connection_id, platform_invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_qb_invoice_mapping_conn ON quickbooks_invoice_mappings(quickbooks_connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_invoice_mapping_inv ON quickbooks_invoice_mappings(platform_invoice_id);
