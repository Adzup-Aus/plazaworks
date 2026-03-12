-- Migration: Add entity_type to clients (individual vs company)
-- Run with: npx tsx scripts/run-migration.ts migrations/009_clients_entity_type.sql

ALTER TABLE clients ADD COLUMN IF NOT EXISTS entity_type varchar(20) NOT NULL DEFAULT 'individual';
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_entity_type_check;
ALTER TABLE clients ADD CONSTRAINT clients_entity_type_check CHECK (entity_type IN ('individual', 'company'));
