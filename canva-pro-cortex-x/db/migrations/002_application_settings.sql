BEGIN;

DO $preflight$
DECLARE
  v_relation oid;
  v_relkind "char";
  v_actual_count integer;
  v_constraint_count integer;
  v_updated_at_default text;
BEGIN
  SELECT c.oid, c.relkind
    INTO v_relation, v_relkind
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
   WHERE n.nspname = current_schema()
     AND c.relname = 'application_settings';

  IF v_relation IS NOT NULL THEN
    IF v_relkind <> 'r' THEN
      RAISE EXCEPTION 'Preflight failed: %.application_settings exists but is not an ordinary table.',
        current_schema();
    END IF;

    SELECT count(*) INTO v_actual_count
      FROM pg_catalog.pg_attribute AS a
     WHERE a.attrelid = v_relation
       AND a.attnum > 0
       AND NOT a.attisdropped;

    SELECT count(*) INTO v_constraint_count
      FROM pg_catalog.pg_constraint AS c
     WHERE c.conrelid = v_relation
       AND c.contype <> 'n';

    SELECT pg_catalog.pg_get_expr(d.adbin, d.adrelid)
      INTO v_updated_at_default
      FROM pg_catalog.pg_attrdef AS d
      JOIN pg_catalog.pg_attribute AS a
        ON a.attrelid = d.adrelid
       AND a.attnum = d.adnum
     WHERE d.adrelid = v_relation
       AND a.attname = 'updated_at'
       AND a.attnum > 0
       AND NOT a.attisdropped;

    IF v_actual_count <> 3
       OR v_constraint_count <> 1
       OR v_updated_at_default IS DISTINCT FROM 'now()'
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute AS a
          WHERE a.attrelid = v_relation AND a.attname = 'setting_key'
            AND a.attnum > 0 AND NOT a.attisdropped
            AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'text'
            AND a.attnotnull
       )
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute AS a
          WHERE a.attrelid = v_relation AND a.attname = 'setting_value'
            AND a.attnum > 0 AND NOT a.attisdropped
            AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'jsonb'
            AND a.attnotnull
       )
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute AS a
          WHERE a.attrelid = v_relation AND a.attname = 'updated_at'
            AND a.attnum > 0 AND NOT a.attisdropped
            AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'timestamp with time zone'
            AND a.attnotnull
       )
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_constraint AS c
          WHERE c.conrelid = v_relation
            AND c.conname = 'application_settings_pkey'
            AND c.contype = 'p'
            AND pg_catalog.pg_get_constraintdef(c.oid, true) = 'PRIMARY KEY (setting_key)'
       )
    THEN
      RAISE EXCEPTION 'Preflight failed: %.application_settings has an incompatible structure.',
        current_schema();
    END IF;
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS application_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Configuration rows are intentionally not seeded; existing settings must be reviewed and restored.
COMMIT;
