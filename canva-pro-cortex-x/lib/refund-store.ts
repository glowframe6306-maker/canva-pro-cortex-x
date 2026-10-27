import type { NeonQueryFunction } from "@neondatabase/serverless";

export type RefundStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "PROCESSED";
export type RefundDeliveryStatus = "PENDING" | "SENDING" | "SENT" | "FAILED" | "UNKNOWN";

export type RefundRequest = {
  refundRequestId: string;
  refundCode: string;
  orderNumber: string;
  referenceNumber: string;
  customerName: string;
  email: string;
  whatsapp: string;
  canvaEmail: string;
  refundReason: string;
  additionalDetails?: string;
  originalPlan?: string;
  originalPlanType?: "WEEKLY" | "MONTHLY" | "YEARLY" | "FREE_TRIAL" | "LIFETIME";
  originalPaidAmount?: number;
  requestedRefundAmount?: number;
  startedAt?: string;
  startedDate?: string;
  startedTime?: string;
  expiresAt?: string;
  expiresDate?: string;
  expiresTime?: string;
  refundEligibleUntil?: string;
  refundEligibleUntilDate?: string;
  refundEligibleUntilTime?: string;
  orderCreatedAt?: string;
  subscriptionStartedAt?: string;
  subscriptionExpiresAt?: string;
  activationStatus?: string;
  orderStatus?: string;
  paymentStatus?: string;
  plan?: string;
  paidAmount?: number;
  submittedAt: string;
  createdAt?: string;
  updatedAt?: string;
  status: RefundStatus;
  telegramNotificationStatus?: RefundDeliveryStatus;
  nextMessageStatus?: RefundDeliveryStatus;
  telegramSent?: boolean;
};

type RefundRow = {
  request_data: unknown;
  status: RefundStatus;
  telegram_notification_status: RefundDeliveryStatus;
  next_message_status: RefundDeliveryStatus;
};

type Queryable = Pick<NeonQueryFunction<false, false>, "query">;

function toRefundRequest(row: RefundRow): RefundRequest {
  const parsed = typeof row.request_data === "string" ? JSON.parse(row.request_data) : row.request_data;
  if (!parsed || typeof parsed !== "object" || !("refundRequestId" in parsed)) {
    throw new Error("Invalid refund request data returned by PostgreSQL.");
  }
  return {
    ...(parsed as RefundRequest),
    status: row.status,
    telegramNotificationStatus: row.telegram_notification_status,
    nextMessageStatus: row.next_message_status,
    telegramSent: row.telegram_notification_status === "SENT",
  };
}

export function createRefundStore(client: Queryable) {
  return {
    async generateRefundRequestId(): Promise<string> {
      const rows = await client.query(
        `SELECT nextval(pg_get_serial_sequence('refund_requests', 'id')) AS next_id`,
      ) as Array<{ next_id: number | string }>;
      const nextId = Number(rows[0]?.next_id);
      if (!Number.isSafeInteger(nextId) || nextId < 1) {
        throw new Error("Unable to allocate a refund request ID.");
      }
      return `REF-${new Date().getFullYear()}-${String(nextId).padStart(6, "0")}`;
    },

    async saveRefundRequest(
      request: RefundRequest,
    ): Promise<{ request: RefundRequest; created: boolean }> {
      const rows = await client.query(
        `INSERT INTO refund_requests (
           refund_request_id, order_number, status, telegram_notification_status,
           next_message_status, request_data
         )
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT DO NOTHING
         RETURNING request_data, status, telegram_notification_status, next_message_status`,
        [
          request.refundRequestId,
          request.orderNumber,
          request.status,
          request.telegramNotificationStatus || "PENDING",
          request.nextMessageStatus || "PENDING",
          JSON.stringify(request),
        ],
      ) as RefundRow[];
      if (rows[0]) return { request: toRefundRequest(rows[0]), created: true };

      const existing = await client.query(
        `SELECT request_data, status, telegram_notification_status, next_message_status
         FROM refund_requests
         WHERE order_number = $1 AND status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED')
         LIMIT 1`,
        [request.orderNumber],
      ) as RefundRow[];
      if (!existing[0]) throw new Error("Refund request conflict could not be resolved.");
      return { request: toRefundRequest(existing[0]), created: false };
    },

    async getAllRefundRequests(): Promise<RefundRequest[]> {
      const rows = await client.query(
        `SELECT request_data, status, telegram_notification_status, next_message_status
         FROM refund_requests
         ORDER BY created_at ASC`,
      ) as RefundRow[];
      return rows.map(toRefundRequest);
    },

    async getRefundRequestById(refundRequestId: string): Promise<RefundRequest | null> {
      const rows = await client.query(
        `SELECT request_data, status, telegram_notification_status, next_message_status
         FROM refund_requests WHERE refund_request_id = $1 LIMIT 1`,
        [refundRequestId],
      ) as RefundRow[];
      return rows[0] ? toRefundRequest(rows[0]) : null;
    },

    async getRefundRequestByOrderNumber(orderNumber: string): Promise<RefundRequest | null> {
      const rows = await client.query(
        `SELECT request_data, status, telegram_notification_status, next_message_status
         FROM refund_requests WHERE order_number = $1
         ORDER BY created_at DESC LIMIT 1`,
        [orderNumber],
      ) as RefundRow[];
      return rows[0] ? toRefundRequest(rows[0]) : null;
    },

    async updateRefundRequestStatus(refundRequestId: string, status: RefundStatus): Promise<RefundRequest | null> {
      const rows = await client.query(
        `UPDATE refund_requests
         SET status = $2,
             request_data = jsonb_set(request_data, '{status}', to_jsonb($2::text), true),
             updated_at = now()
         WHERE refund_request_id = $1
         RETURNING request_data, status, telegram_notification_status, next_message_status`,
        [refundRequestId, status],
      ) as RefundRow[];
      return rows[0] ? toRefundRequest(rows[0]) : null;
    },

    async hasActiveRefundRequest(orderNumber: string): Promise<boolean> {
      const rows = await client.query(
        `SELECT 1 FROM refund_requests
         WHERE order_number = $1 AND status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED')
         LIMIT 1`,
        [orderNumber],
      );
      return rows.length > 0;
    },

    async claimRefundDelivery(refundRequestId: string, kind: "telegram" | "next"): Promise<boolean> {
      const column = kind === "telegram" ? "telegram_notification_status" : "next_message_status";
      const rows = await client.query(
        `UPDATE refund_requests
         SET ${column} = 'SENDING', updated_at = now()
         WHERE refund_request_id = $1 AND ${column} IN ('PENDING', 'FAILED')
         RETURNING refund_request_id`,
        [refundRequestId],
      );
      return rows.length > 0;
    },

    async setRefundDeliveryStatus(
      refundRequestId: string,
      kind: "telegram" | "next",
      status: RefundDeliveryStatus,
    ): Promise<void> {
      const column = kind === "telegram" ? "telegram_notification_status" : "next_message_status";
      const jsonKey = kind === "telegram" ? "telegramNotificationStatus" : "nextMessageStatus";
      await client.query(
        `UPDATE refund_requests
         SET ${column} = $2,
             request_data = jsonb_set(request_data, $3::text[], to_jsonb($2::text), true),
             updated_at = now()
         WHERE refund_request_id = $1`,
        [refundRequestId, status, [jsonKey]],
      );
    },
  };
}
