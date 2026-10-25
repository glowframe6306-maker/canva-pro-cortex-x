BEGIN;

DO $preflight$
DECLARE
  v_table record;
  v_column record;
  v_constraint record;
  v_relation oid;
  v_relkind "char";
  v_existing_table_count integer;
  v_actual_count integer;
  v_expected_count integer;
  v_actual_definition text;
  v_index_compatible boolean;
  v_actual_default text;
BEGIN
  SELECT count(*) INTO v_existing_table_count
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
   WHERE n.nspname = current_schema()
     AND c.relname IN (
       'orders',
       'order_counters',
       'order_receipts',
       'subscription_notification_logs'
     );

  IF v_existing_table_count NOT IN (0, 4) THEN
    RAISE EXCEPTION 'Preflight failed: schema is partially initialized.';
  END IF;

  FOR v_table IN
    SELECT * FROM (VALUES
      ('orders'),
      ('order_counters'),
      ('order_receipts'),
      ('subscription_notification_logs')
    ) AS expected(table_name)
  LOOP
    SELECT c.oid, c.relkind
      INTO v_relation, v_relkind
      FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
     WHERE n.nspname = current_schema()
       AND c.relname = v_table.table_name;

    IF v_relation IS NULL THEN
      CONTINUE;
    END IF;

    IF v_relkind <> 'r' THEN
      RAISE EXCEPTION 'Preflight failed: %.% exists but is not an ordinary table.',
        current_schema(), v_table.table_name;
    END IF;

    SELECT count(*) INTO v_expected_count
      FROM (VALUES
        ('orders', 'order_id', 'text', true),
        ('orders', 'request_id', 'text', false),
        ('orders', 'idempotency_key', 'text', false),
        ('orders', 'payload_hash', 'text', false),
        ('orders', 'canva_email', 'text', true),
        ('orders', 'payment_method', 'text', true),
        ('orders', 'status', 'text', true),
        ('orders', 'order_data', 'jsonb', true),
        ('orders', 'telegram_delivery_status', 'text', true),
        ('orders', 'receipt_delivery_status', 'text', true),
        ('orders', 'next_delivery_status', 'text', true),
        ('orders', 'created_at', 'timestamp with time zone', true),
        ('orders', 'updated_at', 'timestamp with time zone', true),
        ('order_counters', 'counter_date', 'text', true),
        ('order_counters', 'counter_kind', 'text', true),
        ('order_counters', 'last_value', 'bigint', true),
        ('order_receipts', 'order_id', 'text', true),
        ('order_receipts', 'filename', 'text', true),
        ('order_receipts', 'mime_type', 'text', true),
        ('order_receipts', 'content', 'bytea', true),
        ('order_receipts', 'created_at', 'timestamp with time zone', true),
        ('subscription_notification_logs', 'id', 'bigint', true),
        ('subscription_notification_logs', 'request_id', 'text', true),
        ('subscription_notification_logs', 'plan', 'text', true),
        ('subscription_notification_logs', 'notification_type', 'text', true),
        ('subscription_notification_logs', 'scheduled_time', 'text', false),
        ('subscription_notification_logs', 'attempt_time', 'text', true),
        ('subscription_notification_logs', 'status', 'text', true),
        ('subscription_notification_logs', 'error', 'text', false)
      ) AS expected(table_name, column_name, type_name, is_not_null)
     WHERE expected.table_name = v_table.table_name;

    SELECT count(*) INTO v_actual_count
      FROM pg_catalog.pg_attribute AS a
     WHERE a.attrelid = v_relation
       AND a.attnum > 0
       AND NOT a.attisdropped;

    IF v_actual_count <> v_expected_count THEN
      RAISE EXCEPTION 'Preflight failed: %.% has an unexpected column count.',
        current_schema(), v_table.table_name;
    END IF;

    FOR v_column IN
      SELECT expected.column_name, expected.type_name, expected.is_not_null
        FROM (VALUES
          ('orders', 'order_id', 'text', true),
          ('orders', 'request_id', 'text', false),
          ('orders', 'idempotency_key', 'text', false),
          ('orders', 'payload_hash', 'text', false),
          ('orders', 'canva_email', 'text', true),
          ('orders', 'payment_method', 'text', true),
          ('orders', 'status', 'text', true),
          ('orders', 'order_data', 'jsonb', true),
          ('orders', 'telegram_delivery_status', 'text', true),
          ('orders', 'receipt_delivery_status', 'text', true),
          ('orders', 'next_delivery_status', 'text', true),
          ('orders', 'created_at', 'timestamp with time zone', true),
          ('orders', 'updated_at', 'timestamp with time zone', true),
          ('order_counters', 'counter_date', 'text', true),
          ('order_counters', 'counter_kind', 'text', true),
          ('order_counters', 'last_value', 'bigint', true),
          ('order_receipts', 'order_id', 'text', true),
          ('order_receipts', 'filename', 'text', true),
          ('order_receipts', 'mime_type', 'text', true),
          ('order_receipts', 'content', 'bytea', true),
          ('order_receipts', 'created_at', 'timestamp with time zone', true),
          ('subscription_notification_logs', 'id', 'bigint', true),
          ('subscription_notification_logs', 'request_id', 'text', true),
          ('subscription_notification_logs', 'plan', 'text', true),
          ('subscription_notification_logs', 'notification_type', 'text', true),
          ('subscription_notification_logs', 'scheduled_time', 'text', false),
          ('subscription_notification_logs', 'attempt_time', 'text', true),
          ('subscription_notification_logs', 'status', 'text', true),
          ('subscription_notification_logs', 'error', 'text', false)
        ) AS expected(table_name, column_name, type_name, is_not_null)
       WHERE expected.table_name = v_table.table_name
    LOOP
      IF NOT EXISTS (
        SELECT 1
          FROM pg_catalog.pg_attribute AS a
         WHERE a.attrelid = v_relation
           AND a.attname = v_column.column_name
           AND a.attnum > 0
           AND NOT a.attisdropped
           AND pg_catalog.format_type(a.atttypid, a.atttypmod) = v_column.type_name
           AND a.attnotnull = v_column.is_not_null
      ) THEN
        RAISE EXCEPTION 'Preflight failed: %.%.% has an incompatible type or nullability.',
          current_schema(), v_table.table_name, v_column.column_name;
      END IF;
    END LOOP;

    SELECT count(*) INTO v_expected_count
      FROM (VALUES
        ('orders', 'orders_pkey', 'p', 'primarykeyorder_id'),
        ('orders', 'orders_request_id_key', 'u', 'uniquerequest_id'),
        ('orders', 'orders_idempotency_key_key', 'u', 'uniqueidempotency_key'),
        ('orders', 'orders_telegram_delivery_status_check', 'c', $e$checktelegram_delivery_status=anyarray['pending','sending','sent','failed','unknown']$e$),
        ('orders', 'orders_receipt_delivery_status_check', 'c', $e$checkreceipt_delivery_status=anyarray['pending','sending','sent','failed','unknown']$e$),
        ('orders', 'orders_next_delivery_status_check', 'c', $e$checknext_delivery_status=anyarray['pending','sending','sent','failed','unknown']$e$),
        ('order_counters', 'order_counters_pkey', 'p', 'primarykeycounter_date,counter_kind'),
        ('order_counters', 'order_counters_counter_kind_check', 'c', $e$checkcounter_kind=anyarray['mi','ft']$e$),
        ('order_counters', 'order_counters_last_value_check', 'c', 'checklast_value>0'),
        ('order_receipts', 'order_receipts_pkey', 'p', 'primarykeyorder_id'),
        ('order_receipts', 'order_receipts_order_id_fkey', 'f', 'foreignkeyorder_idreferencesordersorder_idondeletecascade'),
        ('subscription_notification_logs', 'subscription_notification_logs_pkey', 'p', 'primarykeyid'),
        ('subscription_notification_logs', 'subscription_notification_logs_status_check', 'c', $e$checkstatus=anyarray['sent','failed']$e$)
      ) AS expected(table_name, constraint_name, constraint_type, normalized_definition)
     WHERE expected.table_name = v_table.table_name;

    SELECT count(*) INTO v_actual_count
      FROM pg_catalog.pg_constraint AS c
     WHERE c.conrelid = v_relation
       AND c.contype <> 'n';

    IF v_actual_count <> v_expected_count THEN
      RAISE EXCEPTION 'Preflight failed: %.% has an unexpected constraint set.',
        current_schema(), v_table.table_name;
    END IF;

    FOR v_constraint IN
      SELECT expected.constraint_name, expected.constraint_type, expected.normalized_definition
        FROM (VALUES
          ('orders', 'orders_pkey', 'p', 'primarykeyorder_id'),
          ('orders', 'orders_request_id_key', 'u', 'uniquerequest_id'),
          ('orders', 'orders_idempotency_key_key', 'u', 'uniqueidempotency_key'),
          ('orders', 'orders_telegram_delivery_status_check', 'c', $e$checktelegram_delivery_status=anyarray['pending','sending','sent','failed','unknown']$e$),
          ('orders', 'orders_receipt_delivery_status_check', 'c', $e$checkreceipt_delivery_status=anyarray['pending','sending','sent','failed','unknown']$e$),
          ('orders', 'orders_next_delivery_status_check', 'c', $e$checknext_delivery_status=anyarray['pending','sending','sent','failed','unknown']$e$),
          ('order_counters', 'order_counters_pkey', 'p', 'primarykeycounter_date,counter_kind'),
          ('order_counters', 'order_counters_counter_kind_check', 'c', $e$checkcounter_kind=anyarray['mi','ft']$e$),
          ('order_counters', 'order_counters_last_value_check', 'c', 'checklast_value>0'),
          ('order_receipts', 'order_receipts_pkey', 'p', 'primarykeyorder_id'),
          ('order_receipts', 'order_receipts_order_id_fkey', 'f', 'foreignkeyorder_idreferencesordersorder_idondeletecascade'),
          ('subscription_notification_logs', 'subscription_notification_logs_pkey', 'p', 'primarykeyid'),
          ('subscription_notification_logs', 'subscription_notification_logs_status_check', 'c', $e$checkstatus=anyarray['sent','failed']$e$)
        ) AS expected(table_name, constraint_name, constraint_type, normalized_definition)
       WHERE expected.table_name = v_table.table_name
    LOOP
      SELECT lower(regexp_replace(
               replace(pg_catalog.pg_get_constraintdef(c.oid), '::text', ''),
               '[[:space:]()]', '', 'g'
             ))
        INTO v_actual_definition
        FROM pg_catalog.pg_constraint AS c
       WHERE c.conrelid = v_relation
         AND c.conname = v_constraint.constraint_name
         AND c.contype = v_constraint.constraint_type
         AND c.convalidated;

      IF v_actual_definition IS DISTINCT FROM v_constraint.normalized_definition THEN
        RAISE EXCEPTION 'Preflight failed: constraint %.% is missing, invalid, or incompatible.',
          v_table.table_name, v_constraint.constraint_name;
      END IF;

      IF v_constraint.constraint_type IN ('p', 'u') THEN
        SELECT EXISTS (
          SELECT 1
            FROM pg_catalog.pg_constraint AS c
            JOIN pg_catalog.pg_index AS i ON i.indexrelid = c.conindid
           WHERE c.conrelid = v_relation
             AND c.conname = v_constraint.constraint_name
             AND i.indisunique
             AND i.indisvalid
             AND i.indisready
        ) INTO v_index_compatible;

        IF NOT v_index_compatible THEN
          RAISE EXCEPTION 'Preflight failed: backing index for %.% is incompatible.',
            v_table.table_name, v_constraint.constraint_name;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  FOR v_column IN
    SELECT * FROM (VALUES
      ('orders', 'canva_email', $e$''::text$e$, ''),
      ('orders', 'status', $e$'pending'::text$e$, ''),
      ('orders', 'telegram_delivery_status', $e$'pending'::text$e$, ''),
      ('orders', 'receipt_delivery_status', $e$'pending'::text$e$, ''),
      ('orders', 'next_delivery_status', $e$'pending'::text$e$, ''),
      ('orders', 'created_at', 'now', ''),
      ('orders', 'updated_at', 'now', ''),
      ('order_receipts', 'created_at', 'now', ''),
      ('subscription_notification_logs', 'id', '', 'a')
    ) AS expected(table_name, column_name, default_expression, identity_kind)
  LOOP
    SELECT lower(regexp_replace(
             COALESCE(pg_catalog.pg_get_expr(d.adbin, d.adrelid), ''),
             '[[:space:]()]', '', 'g'
           ))
      INTO v_actual_default
      FROM pg_catalog.pg_attribute AS a
      JOIN pg_catalog.pg_class AS t ON t.oid = a.attrelid
      JOIN pg_catalog.pg_namespace AS n ON n.oid = t.relnamespace
      LEFT JOIN pg_catalog.pg_attrdef AS d
        ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE n.nspname = current_schema()
       AND t.relname = v_column.table_name
       AND a.attname = v_column.column_name
       AND a.attnum > 0
       AND NOT a.attisdropped;

    IF FOUND THEN
      IF v_actual_default IS DISTINCT FROM v_column.default_expression THEN
        RAISE EXCEPTION 'Preflight failed: default for %.% is incompatible.',
          v_column.table_name, v_column.column_name;
      END IF;

      IF EXISTS (
        SELECT 1
          FROM pg_catalog.pg_attribute AS a
          JOIN pg_catalog.pg_class AS t ON t.oid = a.attrelid
          JOIN pg_catalog.pg_namespace AS n ON n.oid = t.relnamespace
         WHERE n.nspname = current_schema()
           AND t.relname = v_column.table_name
           AND a.attname = v_column.column_name
           AND a.attnum > 0
           AND NOT a.attisdropped
           AND a.attidentity <> v_column.identity_kind
      ) THEN
        RAISE EXCEPTION 'Preflight failed: identity generation for %.% is incompatible.',
          v_column.table_name, v_column.column_name;
      END IF;
    END IF;
  END LOOP;

  IF to_regclass(format('%I.%I', current_schema(), 'orders_free_trial_email_unique')) IS NOT NULL THEN
    SELECT i.indisunique
           AND i.indisvalid
           AND i.indisready
           AND i.indnkeyatts = 1
           AND pg_catalog.pg_get_expr(i.indexprs, i.indrelid) IS NOT NULL
           AND lower(regexp_replace(pg_catalog.pg_get_expr(i.indexprs, i.indrelid), '[[:space:]()]', '', 'g')) = 'lowerbtrimcanva_email'
           AND lower(regexp_replace(replace(pg_catalog.pg_get_expr(i.indpred, i.indrelid), '::text', ''), '[[:space:]()]', '', 'g')) = 'payment_method=''free trial'''
      INTO v_index_compatible
      FROM pg_catalog.pg_index AS i
      JOIN pg_catalog.pg_class AS idx ON idx.oid = i.indexrelid
      JOIN pg_catalog.pg_namespace AS n ON n.oid = idx.relnamespace
      JOIN pg_catalog.pg_class AS tbl ON tbl.oid = i.indrelid
     WHERE n.nspname = current_schema()
       AND idx.relname = 'orders_free_trial_email_unique'
       AND tbl.relname = 'orders';

    IF v_index_compatible IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Preflight failed: orders_free_trial_email_unique is incompatible.';
    END IF;
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS orders (
  order_id text PRIMARY KEY,
  request_id text UNIQUE,
  idempotency_key text UNIQUE,
  payload_hash text,
  canva_email text NOT NULL DEFAULT '',
  payment_method text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  order_data jsonb NOT NULL,
  telegram_delivery_status text NOT NULL DEFAULT 'PENDING'
    CHECK (telegram_delivery_status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'UNKNOWN')),
  receipt_delivery_status text NOT NULL DEFAULT 'PENDING'
    CHECK (receipt_delivery_status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'UNKNOWN')),
  next_delivery_status text NOT NULL DEFAULT 'PENDING'
    CHECK (next_delivery_status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'UNKNOWN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_free_trial_email_unique
  ON orders (lower(btrim(canva_email)))
  WHERE payment_method = 'Free Trial';

CREATE TABLE IF NOT EXISTS order_counters (
  counter_date text NOT NULL,
  counter_kind text NOT NULL CHECK (counter_kind IN ('MI', 'FT')),
  last_value bigint NOT NULL CHECK (last_value > 0),
  PRIMARY KEY (counter_date, counter_kind)
);

CREATE TABLE IF NOT EXISTS order_receipts (
  order_id text PRIMARY KEY REFERENCES orders(order_id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_notification_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id text NOT NULL,
  plan text NOT NULL,
  notification_type text NOT NULL,
  scheduled_time text,
  attempt_time text NOT NULL,
  status text NOT NULL CHECK (status IN ('SENT', 'FAILED')),
  error text
);

COMMIT;
