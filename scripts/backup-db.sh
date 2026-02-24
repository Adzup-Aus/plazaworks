#!/usr/bin/env bash
# Backup database before running 003-remove-multi-org migration.
# Usage: ./scripts/backup-db.sh
# Requires: DATABASE_URL in .env or environment

set -e
if [ -z "$DATABASE_URL" ]; then
  echo "Load .env first: source .env 2>/dev/null || true"
  export $(grep -v '^#' .env 2>/dev/null | xargs) 2>/dev/null || true
fi
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set. Set it in .env or environment."
  exit 1
fi
BACKUP_FILE="backup_pre_remove_multi_org_$(date +%Y%m%d_%H%M%S).sql"
echo "Backing up to $BACKUP_FILE ..."
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
echo "Done. Restore with: psql \$DATABASE_URL < $BACKUP_FILE"
