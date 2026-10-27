BEGIN;

CREATE TABLE IF NOT EXISTS refund_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  refund_request_id text NOT NULL UNIQUE,
  order_number text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PROCESSED')),
  telegram_notification_status text NOT NULL DEFAULT 'PENDING'
    CHECK (telegram_notification_status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'UNKNOWN')),
  next_message_status text NOT NULL DEFAULT 'PENDING'
    CHECK (next_message_status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'UNKNOWN')),
  request_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_active_order_unique
  ON refund_requests (order_number)
  WHERE status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED');

COMMIT;
