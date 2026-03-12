-- Migration: QuickBooks sync log for status monitor
-- Run with: tsx scripts/run-migration.ts migrations/008_quickbooks_sync_log.sql

CREATE TABLE IF NOT EXISTS quickbooks_sync_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  quickbooks_connection_id varchar(255) NOT NULL REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  entity_type varchar(20) NOT NULL,
  entity_id varchar(255) NOT NULL,
  status varchar(20) NOT NULL,
  error_message text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qb_sync_log_created ON quickbooks_sync_log(created_at);
CREATE INDEX IF NOT EXISTS idx_qb_sync_log_status ON quickbooks_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_qb_sync_log_conn ON quickbooks_sync_log(quickbooks_connection_id);
