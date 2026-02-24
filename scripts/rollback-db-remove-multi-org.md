# Rollback: Remove Multi-Organization Migration

If you need to undo the database changes from feature `003-remove-multi-org`:

1. **Restore from backup** (if you ran `./scripts/backup-db.sh` before migrating):
   ```bash
   psql "$DATABASE_URL" < backup_pre_remove_multi_org_YYYYMMDD_HHMMSS.sql
   ```

2. **Revert code** to the commit before the migration:
   ```bash
   git checkout main -- shared/ server/ client/
   # Or: git revert <commit-range>
   ```

3. **Restart the app** and run tests:
   ```bash
   npm run test:env
   ```

Note: There is no automatic "down" migration; restoration is via backup or git revert.
