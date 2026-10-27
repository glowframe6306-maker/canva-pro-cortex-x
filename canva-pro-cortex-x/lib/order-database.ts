/**
 * Order persistence backed by Neon PostgreSQL.
 */

import { getPostgresClient } from "@/lib/postgres";
import type { DeliveryStatus } from "@/lib/order-submission";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export type OrderStatus =
  | "PENDING"
  | "APPROVED"
  | "ACTIVE"
  | "EXPIRING_IN_1_DAY"
  | "EXPIRED"
  | "REJECTED"
  | "REQUEST_SENT"
  | "CANCELLED";

export interface StoredOrder {
  orderId: string;
  requestId?: string;
  orderCreatedAt: string;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  canvaEmail: string;
  paymentMethod: "Free Trial" | "Bank Transfer" | "Other";
  paymentStatus?: "PENDING" | "APPROVED" | "PAID" | "REJECTED" | "FAILED";
  paymentDetails?: string;
  receiptFilename?: string;
  receiptPath?: string;
  storageKey?: string;
  selectedPlan: string;
  planPrice?: string;
  mainPrice?: number;
  promotionName?: string;
  promotionId?: string;
  promotionPrice?: number;
  promotionDiscountPercentage?: number;
  promotionDiscountAmount?: number;
  promotionApplied?: boolean;
  promoCode?: string;
  promoCodeOfferDiscountAmount?: number;
  promoDiscountAmount?: number;
  promoCodeApplied?: boolean;
  discountType?: "NONE" | "PROMOTION" | "PROMO_CODE" | "PROMOTION + PROMO_CODE";
  discountPercentage?: number;
  discountAmount?: number;
  finalPrice?: number;
  additionalInfo?: string;
  createdDate?: string;
  createdTime?: string;
  activatedAt?: string;
  activationDate?: string;
  activationTime?: string;
  expiryAt?: string;
  expiryDate?: string;
  expiryTime?: string;
  durationDays?: number;
  planType?: "FREE_TRIAL" | "WEEKLY" | "MONTHLY" | "YEARLY" | "LIFETIME";
  duration?: string;
  reminderAt?: string;
  reminderDate?: string;
  reminderTime?: string;
  reminderStatus?: "PENDING" | "SENT" | "FAILED";
  reminderSentAt?: string;
  expiryNotificationStatus?: "PENDING" | "SENT" | "FAILED";
  trialStartDate?: string;
  trialStartTime?: string;
  trialStartAt?: string;
  trialEndDate?: string;
  trialEndTime?: string;
  trialEndAt?: string;
  status?: OrderStatus;
  expirationNotificationSent?: boolean;
  expirationNotificationSentAt?: string;
  requestReceivedAt?: string;
  activationDeadlineAt?: string;
  orderNextMessageSentAt?: string;
  trialNextMessageSentAt?: string;
  reminderNextMessageSentAt?: string;
  expiryNextMessageSentAt?: string;
}

export type SubscriptionNotificationLog = {
  requestId: string;
  plan: string;
  notificationType: string;
  scheduledTime?: string;
  attemptTime: string;
  status: "SENT" | "FAILED";
  error?: string;
};

export type DeliveryKind = "telegram" | "receipt" | "next";

export type PersistedOrder = {
  order: StoredOrder;
  payloadHash: string;
  telegramDeliveryStatus: DeliveryStatus;
  receiptDeliveryStatus: DeliveryStatus;
  nextDeliveryStatus: DeliveryStatus;
};

type OrderRow = {
  order_data: unknown;
  payload_hash: string | null;
  telegram_delivery_status: DeliveryStatus;
  receipt_delivery_status: DeliveryStatus;
  next_delivery_status: DeliveryStatus;
};

type Queryable = Pick<NeonQueryFunction<false, false>, "query">;

function getQueryClient(): Queryable {
  return getPostgresClient();
}

function deserializeOrder(value: unknown): StoredOrder {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || !("orderId" in parsed) || typeof parsed.orderId !== "string") {
    throw new Error("Invalid order data returned by PostgreSQL.");
  }
  return parsed as StoredOrder;
}

function toPersistedOrder(row: OrderRow): PersistedOrder {
  return {
    order: deserializeOrder(row.order_data),
    payloadHash: row.payload_hash || "",
    telegramDeliveryStatus: row.telegram_delivery_status,
    receiptDeliveryStatus: row.receipt_delivery_status,
    nextDeliveryStatus: row.next_delivery_status,
  };
}

const persistedOrderColumns = `
  order_data,
  payload_hash,
  telegram_delivery_status,
  receipt_delivery_status,
  next_delivery_status
`;

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key was previously used with different order details.");
    this.name = "IdempotencyConflictError";
  }
}

export async function createOrderIdempotently(
  order: StoredOrder,
  idempotencyKey: string,
  payloadHash: string,
): Promise<{ persisted: PersistedOrder; created: boolean }> {
  const rows = await getQueryClient().query(
    `INSERT INTO orders (
       order_id, request_id, idempotency_key, payload_hash, canva_email, payment_method,
       status, order_data
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING ${persistedOrderColumns}`,
    [
      order.orderId,
      order.requestId || null,
      idempotencyKey,
      payloadHash,
      order.canvaEmail,
      order.paymentMethod,
      order.status || "PENDING",
      JSON.stringify(order),
    ],
  ) as OrderRow[];

  if (rows[0]) return { persisted: toPersistedOrder(rows[0]), created: true };

  const existing = await getQueryClient().query(
    `SELECT ${persistedOrderColumns}
     FROM orders
     WHERE idempotency_key = $1
     LIMIT 1`,
    [idempotencyKey],
  ) as OrderRow[];

  if (!existing[0]) throw new Error("Order idempotency record could not be loaded.");
  const persisted = toPersistedOrder(existing[0]);
  if (persisted.payloadHash !== payloadHash) throw new IdempotencyConflictError();
  return { persisted, created: false };
}

export async function getOrderByIdempotencyKey(key: string): Promise<PersistedOrder | null> {
  const rows = await getQueryClient().query(
    `SELECT ${persistedOrderColumns} FROM orders WHERE idempotency_key = $1 LIMIT 1`,
    [key],
  ) as OrderRow[];
  return rows[0] ? toPersistedOrder(rows[0]) : null;
}

export async function claimDelivery(orderId: string, kind: DeliveryKind): Promise<boolean> {
  const column = {
    telegram: "telegram_delivery_status",
    receipt: "receipt_delivery_status",
    next: "next_delivery_status",
  }[kind];
  const rows = await getQueryClient().query(
    `UPDATE orders
     SET ${column} = 'SENDING', updated_at = now()
     WHERE order_id = $1 AND ${column} IN ('PENDING', 'FAILED')
     RETURNING order_id`,
    [orderId],
  );
  return rows.length > 0;
}

export async function setDeliveryStatus(orderId: string, kind: DeliveryKind, status: DeliveryStatus): Promise<void> {
  const column = {
    telegram: "telegram_delivery_status",
    receipt: "receipt_delivery_status",
    next: "next_delivery_status",
  }[kind];
  await getQueryClient().query(
    `UPDATE orders SET ${column} = $1, updated_at = now() WHERE order_id = $2`,
    [status, orderId],
  );
}

export async function getNextOrderCounter(kind: "MI" | "FT", date: string): Promise<number> {
  const rows = await getQueryClient().query(
    `INSERT INTO order_counters (counter_date, counter_kind, last_value)
     VALUES ($1, $2, 1)
     ON CONFLICT (counter_date, counter_kind)
     DO UPDATE SET last_value = order_counters.last_value + 1
     RETURNING last_value`,
    [date, kind],
  ) as Array<{ last_value: number | string }>;
  const value = Number(rows[0]?.last_value);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Unable to allocate an order number.");
  return value;
}

export async function getAllOrders(): Promise<StoredOrder[]> {
  const rows = await getQueryClient().query(
    "SELECT order_data FROM orders ORDER BY created_at ASC",
  ) as Array<{ order_data: unknown }>;
  return rows.map((row) => deserializeOrder(row.order_data));
}

export async function getSubscriptionNotificationLogs(): Promise<SubscriptionNotificationLog[]> {
  const rows = await getQueryClient().query(
    `SELECT request_id, plan, notification_type, scheduled_time, attempt_time, status, error
     FROM subscription_notification_logs
     ORDER BY id ASC`,
  ) as Array<{
    request_id: string;
    plan: string;
    notification_type: string;
    scheduled_time: string | null;
    attempt_time: string;
    status: "SENT" | "FAILED";
    error: string | null;
  }>;
  return rows.map((row) => ({
    requestId: row.request_id,
    plan: row.plan,
    notificationType: row.notification_type,
    scheduledTime: row.scheduled_time || undefined,
    attemptTime: row.attempt_time,
    status: row.status,
    error: row.error || undefined,
  }));
}

export async function appendSubscriptionNotificationLog(log: SubscriptionNotificationLog): Promise<void> {
  await getQueryClient().query(
    `INSERT INTO subscription_notification_logs (
       request_id, plan, notification_type, scheduled_time, attempt_time, status, error
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [log.requestId, log.plan, log.notificationType, log.scheduledTime || null, log.attemptTime, log.status, log.error || null],
  );
}

export async function getOrderById(orderId: string): Promise<StoredOrder | null> {
  const rows = await getQueryClient().query(
    "SELECT order_data FROM orders WHERE order_id = $1 LIMIT 1",
    [orderId],
  ) as Array<{ order_data: unknown }>;
  return rows[0] ? deserializeOrder(rows[0].order_data) : null;
}

export async function getOrderByOrderNumber(orderNumber: string): Promise<StoredOrder | null> {
  const normalized = String(orderNumber || "").trim();
  if (!normalized) return null;
  const rows = await getQueryClient().query(
    `SELECT order_data FROM orders
     WHERE order_id = $1 OR request_id = $1
        OR lower(order_id) = lower($1) OR lower(request_id) = lower($1)
     ORDER BY CASE WHEN order_id = $1 OR request_id = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [normalized],
  ) as Array<{ order_data: unknown }>;
  return rows[0] ? deserializeOrder(rows[0].order_data) : null;
}

export async function saveOrder(order: StoredOrder): Promise<void> {
  await getQueryClient().query(
    `INSERT INTO orders (order_id, request_id, canva_email, payment_method, status, order_data)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (order_id) DO UPDATE SET
       request_id = EXCLUDED.request_id,
       canva_email = EXCLUDED.canva_email,
       payment_method = EXCLUDED.payment_method,
       status = EXCLUDED.status,
       order_data = EXCLUDED.order_data,
       updated_at = now()`,
    [order.orderId, order.requestId || null, order.canvaEmail, order.paymentMethod, order.status || "PENDING", JSON.stringify(order)],
  );
}

export async function updateOrder(orderId: string, updates: Partial<StoredOrder>): Promise<StoredOrder | null> {
  const updatedAt = new Date().toISOString();
  const safeUpdates = { ...updates, orderId, updatedAt };
  const removedKeys = Object.entries(updates)
    .filter(([, value]) => value === undefined)
    .map(([key]) => key);
  const rows = await getQueryClient().query(
    `UPDATE orders
     SET order_data = (order_data || $1::jsonb) - $2::text[],
         status = COALESCE($3, status),
         canva_email = COALESCE($4, canva_email),
         payment_method = COALESCE($5, payment_method),
         updated_at = now()
     WHERE order_id = $6
     RETURNING order_data`,
    [
      JSON.stringify(safeUpdates),
      removedKeys,
      updates.status || null,
      updates.canvaEmail || null,
      updates.paymentMethod || null,
      orderId,
    ],
  ) as Array<{ order_data: unknown }>;
  return rows[0] ? deserializeOrder(rows[0].order_data) : null;
}

export async function getOrderSnapshot(orderId: string): Promise<PersistedOrder | null> {
  const rows = await getQueryClient().query(
    `SELECT ${persistedOrderColumns} FROM orders WHERE order_id = $1 LIMIT 1`,
    [orderId],
  ) as OrderRow[];
  return rows[0] ? toPersistedOrder(rows[0]) : null;
}

export async function getOrdersReadyForExpiration(): Promise<StoredOrder[]> {
  const orders = await getAllOrders();
  const now = new Date();
  return orders.filter((order) => {
    if (!order.expiryAt) return false;
    const effectiveStatus = order.status || "PENDING";
    if ((effectiveStatus !== "ACTIVE" && effectiveStatus !== "EXPIRING_IN_1_DAY") || order.expirationNotificationSent) return false;
    const expiryDate = new Date(order.expiryAt);
    return !Number.isNaN(expiryDate.getTime()) && now >= expiryDate;
  });
}

export async function getOrdersReadyForReminder(): Promise<StoredOrder[]> {
  const orders = await getAllOrders();
  const now = Date.now();
  return orders.filter((order) => {
    const effectiveStatus = order.status || "PENDING";
    if (!order.reminderAt || order.reminderSentAt) return false;
    if (effectiveStatus !== "ACTIVE" && effectiveStatus !== "EXPIRING_IN_1_DAY") return false;
    const reminderAt = new Date(order.reminderAt).getTime();
    return !Number.isNaN(reminderAt) && reminderAt <= now;
  });
}

export async function getOrdersByStatus(status: OrderStatus): Promise<StoredOrder[]> {
  const orders = await getAllOrders();
  return orders.filter((order) => (order.status || "PENDING") === status);
}

export function normalizeStoredStatus(status?: string): OrderStatus {
  if (!status) return "PENDING";
  if (status === "REQUEST_SENT") return "PENDING";
  if (status === "APPROVED") return "ACTIVE";
  return ["PENDING", "ACTIVE", "EXPIRING_IN_1_DAY", "EXPIRED", "REJECTED", "CANCELLED"].includes(status)
    ? status as OrderStatus
    : "PENDING";
}

export async function activateOrderIfPending(orderId: string, updates: Partial<StoredOrder>): Promise<StoredOrder | null> {
  const updatedAt = new Date().toISOString();
  const safeUpdates = { ...updates, orderId, status: "ACTIVE", updatedAt };
  const rows = await getQueryClient().query(
    `UPDATE orders
     SET order_data = order_data || $1::jsonb,
         status = 'ACTIVE',
         updated_at = now()
     WHERE order_id = $2 AND status IN ('PENDING', 'REQUEST_SENT')
     RETURNING order_data`,
    [JSON.stringify(safeUpdates), orderId],
  ) as Array<{ order_data: unknown }>;
  return rows[0] ? deserializeOrder(rows[0].order_data) : null;
}

export async function markExpirationNotificationSent(orderId: string): Promise<StoredOrder | null> {
  const sentAt = new Date().toISOString();
  return updateOrder(orderId, {
    expirationNotificationSent: true,
    expirationNotificationSentAt: sentAt,
    expiryNotificationStatus: "SENT",
    expiredAt: sentAt,
    status: "EXPIRED",
  });
}

export async function markReminderSent(orderId: string, sentAt: string): Promise<StoredOrder | null> {
  return updateOrder(orderId, { reminderStatus: "SENT", reminderSentAt: sentAt, status: "EXPIRING_IN_1_DAY" });
}

export async function markReminderFailed(orderId: string): Promise<StoredOrder | null> {
  return updateOrder(orderId, { reminderStatus: "FAILED" });
}

export async function markExpirationFailed(orderId: string): Promise<StoredOrder | null> {
  return updateOrder(orderId, { expiryNotificationStatus: "FAILED" });
}

export async function markOrderNextMessageSent(orderId: string, sentAt: string): Promise<StoredOrder | null> {
  return updateOrder(orderId, { orderNextMessageSentAt: sentAt });
}

export async function markTrialNextMessageSent(orderId: string, sentAt: string): Promise<StoredOrder | null> {
  return updateOrder(orderId, { trialNextMessageSentAt: sentAt });
}

export async function markReminderNextMessageSent(orderId: string, sentAt: string): Promise<StoredOrder | null> {
  return updateOrder(orderId, { reminderNextMessageSentAt: sentAt });
}

export async function markExpiryNextMessageSent(orderId: string, sentAt: string): Promise<StoredOrder | null> {
  return updateOrder(orderId, { expiryNextMessageSentAt: sentAt });
}

export async function hasFreeTrial(normalizedCanvaEmail: string): Promise<boolean> {
  const rows = await getQueryClient().query(
    `SELECT 1 FROM orders
     WHERE payment_method = 'Free Trial' AND lower(btrim(canva_email)) = lower(btrim($1))
     LIMIT 1`,
    [normalizedCanvaEmail],
  );
  return rows.length > 0;
}
