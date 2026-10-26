# Database migrations and settings import

Apply `001_order_storage.sql` and then `002_application_settings.sql` to an explicitly selected, authorized non-production database before testing order submission. Migration `002` creates the settings table but intentionally does not seed it.

## Importing existing settings

The working-tree copies of `.data/site-settings.json` and `.data/promotions.json` and their Git-history versions differ. The working-tree files were structurally valid when checked, but no candidate is confirmed to represent production. Compare candidates by hash and provenance without copying their contents into logs, and do not select an older Git-history version merely because it is committed.

After the settings owner verifies the source candidates, parse those exact files locally and pass them to `importApplicationSettingsIfMissing` from `lib/application-settings-store.ts`. This importer uses one parameterized statement and `ON CONFLICT DO NOTHING`: it inserts missing keys, preserves existing database rows, and reports inserted versus preserved keys. Re-running it is safe. Do not substitute `saveApplicationSetting` for an import because that operation intentionally updates existing values.

Before import, record the two source-file SHA-256 hashes. After import, verify only key presence and JSON types (for example, select `setting_key` and `jsonb_typeof(setting_value)`), then read the settings through the admin APIs. If a key was preserved because it already existed, stop and compare its approved source before making any update. Never include the JSON values or database connection string in command output or logs.

Do not run this process against production until migration and import are explicitly authorized. Production configuration remains unverified.
