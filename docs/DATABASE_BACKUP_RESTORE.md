# Database Backup + Restore Procedure

**Repository:** lonniebeal-droid/sbos-monorepo
**Issue:** #14 - P1 medical production lane, Task #5
**Date:** 2026-10-10

## Current State

- Database: PostgreSQL (via Prisma, `packages/database/prisma/schema.prisma`)
- Production hosting: Railway Postgres (attached to `SBOS Demo` project)
- Migrations: applied at container startup (`apps/api/Dockerfile` line 38)

## BAA Warning

> **Do NOT process PHI through Railway until a BAA is confirmed** (Issue #14).
> If Railway Postgres cannot be covered under a BAA, migrate to the hosted
> HIPAA-ready Supabase project (or another covered database) BEFORE any PHI
> touches the database. The procedure below uses synthetic data only.

## Automated Backup (Railway)

Railway provides automatic daily backups for Postgres. Verify in dashboard:
1. Railway project `SBOS Demo` > Postgres service > Backups tab
2. Confirm daily snapshots are enabled and retained per policy
3. Note the backup window; avoid schema migrations during it

## Manual Backup (pg_dump)

```bash
# From any machine with psql + network access to Railway Postgres:
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="sbos-backup-$(date +%Y%m%d-%H%M%S).dump" \
  --no-owner --no-privileges

# Verify the dump is restorable (header check):
pg_restore --list "sbos-backup-*.dump" | head -20
```

Store dumps encrypted at rest. Never commit dumps to git.

## Restore Test (Synthetic Data Only)

```bash
# 1. Create an empty test database (NOT production):
createdb sbos_restore_test

# 2. Restore the dump:
pg_restore --dbname="postgresql://user:pass@host:5432/sbos_restore_test" \
  --no-owner --no-privileges "sbos-backup-*.dump"

# 3. Run Prisma migrations to confirm schema parity:
DATABASE_URL="postgresql://user:pass@host:5432/sbos_restore_test" \
  pnpm --filter @sbos/database prisma migrate deploy

# 4. Smoke-check row counts on key tables:
psql "$TEST_DATABASE_URL" -c "SELECT count(*) FROM \"User\";"
psql "$TEST_DATABASE_URL" -c "SELECT count(*) FROM \"AuditLog\";"

# 5. Drop the test database when done:
dropdb sbos_restore_test
```

Run the restore test monthly and after any major migration. Record the
result (date, dump file, row counts, pass/fail) in the ops log.

## Migration to BAA-Covered Database (When Required)

1. Provision the HIPAA-ready Supabase Postgres (or other covered host).
2. Set the new `DATABASE_URL` in Railway environment (staging first).
3. `prisma migrate deploy` against the new database.
4. Backfill: `pg_dump` from Railway, `pg_restore` to the new host.
5. Verify row counts match, run the API smoke tests.
6. Cut over `DATABASE_URL` in production; keep the Railway DB read-only
   for 7 days as rollback insurance, then decommission.
