BEGIN;

DO $preflight$
DECLARE
  v_relation oid;
  v_relkind "char";
  v_column_count integer;
  v_constraint_count integer;
  v_created_at_default text;
BEGIN
  SELECT c.oid, c.relkind
    INTO v_relation, v_relkind
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
   WHERE n.nspname = current_schema()
     AND c.relname = 'customer_service_requests';

  IF v_relation IS NOT NULL THEN
    IF v_relkind <> 'r' THEN
      RAISE EXCEPTION 'Preflight failed: %.customer_service_requests exists but is not an ordinary table.',
        current_schema();
    END IF;

    SELECT count(*) INTO v_column_count
      FROM pg_catalog.pg_attribute AS a
     WHERE a.attrelid = v_relation
       AND a.attnum > 0
       AND NOT a.attisdropped;

    SELECT count(*) INTO v_constraint_count
      FROM pg_catalog.pg_constraint AS c
     WHERE c.conrelid = v_relation;

    SELECT pg_catalog.pg_get_expr(d.adbin, d.adrelid)
      INTO v_created_at_default
      FROM pg_catalog.pg_attrdef AS d
      JOIN pg_catalog.pg_attribute AS a
        ON a.attrelid = d.adrelid
       AND a.attnum = d.adnum
     WHERE d.adrelid = v_relation
       AND a.attname = 'created_at'
       AND a.attnum > 0
       AND NOT a.attisdropped;

    IF v_column_count <> 4
       OR v_constraint_count <> 3
       OR v_created_at_default IS DISTINCT FROM 'now()'
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute AS a
          WHERE a.attrelid = v_relation AND a.attname = 'id'
            AND a.attnum > 0 AND NOT a.attisdropped
            AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'bigint'
            AND a.attnotnull AND a.attidentity = 'a'
       )
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute AS a
          WHERE a.attrelid = v_relation AND a.attname = 'request_id'
            AND a.attnum > 0 AND NOT a.attisdropped
            AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'text'
            AND a.attnotnull
       )
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute AS a
          WHERE a.attrelid = v_relation AND a.attname = 'request_data'
            AND a.attnum > 0 AND NOT a.attisdropped
            AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'jsonb'
            AND a.attnotnull
       )
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute AS a
          WHERE a.attrelid = v_relation AND a.attname = 'created_at'
            AND a.attnum > 0 AND NOT a.attisdropped
            AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'timestamp with time zone'
            AND a.attnotnull
       )
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_constraint AS c
          WHERE c.conrelid = v_relation AND c.contype = 'p'
            AND pg_catalog.pg_get_constraintdef(c.oid, true) = 'PRIMARY KEY (id)'
       )
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_constraint AS c
          WHERE c.conrelid = v_relation AND c.contype = 'u'
            AND pg_catalog.pg_get_constraintdef(c.oid, true) = 'UNIQUE (request_id)'
       )
       OR NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_constraint AS c
          WHERE c.conrelid = v_relation AND c.contype = 'c'
            AND pg_catalog.pg_get_constraintdef(c.oid, true) LIKE '%jsonb_typeof(request_data)%'
       )
    THEN
      RAISE EXCEPTION 'Preflight failed: %.customer_service_requests has an incompatible structure.',
        current_schema();
    END IF;
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS customer_service_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id text NOT NULL UNIQUE,
  request_data jsonb NOT NULL CHECK (jsonb_typeof(request_data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_service_requests_created_at_idx
  ON customer_service_requests (created_at);

COMMIT;
