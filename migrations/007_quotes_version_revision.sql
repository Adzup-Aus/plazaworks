-- Migration: Add version to quotes (revision number); same quote_number across revisions
-- Run with: npm run db:migrate:quotes-version
-- Or: npx tsx scripts/run-migration.ts migrations/007_quotes_version_revision.sql

-- 1. Add version column (holds revision number)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- 2. Backfill version from revision_number for existing rows
UPDATE quotes SET version = revision_number;

-- 3. Drop old unique on quote_number (PostgreSQL default: quotes_quote_number_key)
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_quote_number_key;

-- 4. Add composite unique so same quote_number can have multiple revisions (versions)
ALTER TABLE quotes ADD CONSTRAINT quotes_quote_number_version_key UNIQUE (quote_number, version);
