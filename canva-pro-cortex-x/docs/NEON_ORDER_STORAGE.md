# Neon order storage

Order records, daily identifiers, Telegram delivery state, subscription notification logs, and payment receipts are stored in Neon PostgreSQL. The application uses `@neondatabase/serverless` over HTTPS and prefers Vercel's `POSTGRES_URL`, falling back to `DATABASE_URL`. The HTTP driver does not retain per-invocation database sockets or require an application-managed pool.

## Schema migration

`db/migrations/001_order_storage.sql` wraps schema preflight and DDL in one PostgreSQL transaction. Before any DDL, it checks same-schema objects for expected table kinds, exact column sets/types/nullability, defaults and identity generation, named constraints and their definitions, constraint backing indexes, and the trial-email expression index. An incompatible existing object causes an exception; the migration does not drop, overwrite, or repair it.

- **Fresh schema:** the preflight allows the expected objects to be absent; the DDL creates them.
- **Rerun:** a schema created by this migration passes preflight and the `IF NOT EXISTS` statements leave its objects unchanged. A partial or differently shaped schema fails closed rather than being repaired.
- **Atomicity:** run the complete file with a transaction-aware PostgreSQL client. With `psql`, use `psql -v ON_ERROR_STOP=1 -f db/migrations/001_order_storage.sql`; if any statement fails, stop and explicitly `ROLLBACK` that session before continuing. Do not execute only a selected portion of the file. SQL-editor transaction semantics must be confirmed before use.

These are static migration guarantees; no database has been connected to or used to verify PostgreSQL catalog behavior. Use an explicitly identified isolated non-production database for the next execution validation. Never paste connection strings or credentials into source control, chat, logs, or this document; verify the target database/branch before running anything.

## Existing local data

The previous implementation stored records and receipt files under local `PAYMENTS` paths. This migration does not import those files. Whether there are records that must be preserved or backfilled has not been established. Review and approve any export/import separately before switching production reads to this schema; preserve the originals until the import has been verified.

The offline receipt crosswalk verifier can check the immutable backup without database access:

```powershell
node scripts/verify-legacy-receipt-crosswalk.mjs "C:\path\to\verified-snapshot"
```

It verifies every manifest-listed file and emits aggregate order/receipt counts plus ordinal backup paths, file sizes, and receipt hashes. It does not emit original receipt references or order/customer fields, and it does not modify the snapshot.

## Delivery retry behavior

Each customer submission carries a stable idempotency key and a content hash. PostgreSQL enforces uniqueness and atomically claims each Telegram delivery step. An explicit Telegram rejection is retryable with the same key. If the request outcome is ambiguous (for example, a network timeout after Telegram may have accepted the message), the delivery is marked `UNKNOWN` and is not automatically sent again. A process interruption can also leave a step in `SENDING`; reconcile `SENDING`/`UNKNOWN` states before retrying to avoid duplicate notifications. Telegram does not provide an exactly-once delivery guarantee.

## Validation without production writes

Focused tests and the Next.js build do not need a live database. Do not run the migration or submit a real customer order as a test. A production migration and deployment require separate authorization and verification.
