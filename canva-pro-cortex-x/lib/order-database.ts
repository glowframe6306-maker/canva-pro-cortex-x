/**
 * Order database and persistence system
 * Stores and manages all orders with expiry information
 */

import fs from "node:fs/promises";
import path from "node:path";

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
  // Identifiers
  orderId: string;
  requestId?: string;
  orderCreatedAt: string; // ISO timestamp when order was created
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;

  // Customer info
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  canvaEmail: string;

  // Payment info
  paymentMethod: "Free Trial" | "Bank Transfer" | "Other";
  paymentStatus?: "PENDING" | "APPROVED" | "PAID" | "REJECTED" | "FAILED";
  paymentDetails?: string; // Reference number for bank transfer
  receiptFilename?: string;
  receiptPath?: string;
  storageKey?: string;

  // Plan info
  selectedPlan: string; // Display name (e.g., "WEEKLY", "MONTHLY")
  planPrice?: string; // final verified price for the order
  mainPrice?: number;
  promotionName?: string;
  promotionId?: string;
  promotionPrice?: number;
  promotionDiscountPercentage?: number;
  promotionDiscountAmount?: number;
  promoCode?: string;
  discountType?: "NONE" | "PROMOTION" | "PROMO_CODE" | "PROMOTION + PROMO_CODE";
  discountPercentage?: number;
  discountAmount?: number;
  finalPrice?: number;
  additionalInfo?: string;

  // Creation timestamps (for REQUEST_SENT status)
  createdDate?: string; // YYYY-MM-DD - when order/request was created
  createdTime?: string; // HH:mm:ss - when order/request was created

  // Activation and expiry tracking
  activatedAt?: string; // ISO timestamp when access was activated
  activationDate?: string; // YYYY-MM-DD
  activationTime?: string; // HH:mm:ss
  expiryAt?: string; // ISO timestamp when plan expires (null for LIFETIME)
  expiryDate?: string; // YYYY-MM-DD (or "NEVER" for LIFETIME)
  expiryTime?: string; // HH:mm:ss (or "NEVER" for LIFETIME)
  durationDays?: number;
  planType?: "FREE_TRIAL" | "WEEKLY" | "MONTHLY" | "YEARLY" | "LIFETIME";
  duration?: string;
  reminderAt?: string;
  reminderDate?: string;
  reminderTime?: string;
  reminderStatus?: "PENDING" | "SENT" | "FAILED";
  reminderSentAt?: string;
  expiryNotificationStatus?: "PENDING" | "SENT" | "FAILED";

  // Trial-specific
  trialStartDate?: string; // YYYY-MM-DD - when trial was activated (if activated)
  trialStartTime?: string; // HH:mm:ss - when trial was activated (if activated)
  trialStartAt?: string; // ISO timestamp when trial was activated
  trialEndDate?: string; // YYYY-MM-DD - calculated from trialStartDate + 3 days
  trialEndTime?: string; // HH:mm:ss - calculated from trialStartDate + 3 days
  trialEndAt?: string; // ISO timestamp when trial expires

  // Status tracking
  status?: OrderStatus;
  expirationNotificationSent?: boolean;
  expirationNotificationSentAt?: string; // ISO timestamp
  requestReceivedAt?: string; // ISO timestamp when request was received
  activationDeadlineAt?: string; // ISO timestamp for 24-hour deadline (requestReceivedAt + 24 hours)

  // NEXT message tracking (sent automatically after successful main workflow message)
  orderNextMessageSentAt?: string; // ISO timestamp when order NEXT message was sent
  trialNextMessageSentAt?: string; // ISO timestamp when trial NEXT message was sent
  reminderNextMessageSentAt?: string; // ISO timestamp when reminder NEXT message was sent
  expiryNextMessageSentAt?: string; // ISO timestamp when expiry NEXT message was sent
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

const DEFAULT_ORDERS_DIR = path.join("C:\\Users\\Administrator\\CANVA PRO", "PAYMENTS");

function getOrdersDir(): string {
  return process.env.ORDERS_DIR || DEFAULT_ORDERS_DIR;
}

function getOrdersFilePath(): string {
  return path.join(getOrdersDir(), ".orders.json");
}

function getNotificationLogPath(): string {
  return path.join(getOrdersDir(), ".subscription-notification-log.json");
}

/**
 * Ensure the orders directory and database file exist
 */
async function ensureOrdersDatabase() {
  const ordersDir = getOrdersDir();
  const ordersFile = getOrdersFilePath();

  await fs.mkdir(ordersDir, { recursive: true });

  try {
    await fs.access(ordersFile);
  } catch {
    // File doesn't exist, create empty database
    await fs.writeFile(ordersFile, JSON.stringify({ orders: [], version: 1 }, null, 2), "utf8");
  }
}

function parseOrdersDatabase(raw: string): StoredOrder[] {
  const sanitized = String(raw || "").replace(/^\uFEFF/, "").trim();
  if (!sanitized) return [];

  const parsed = JSON.parse(sanitized);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.orders)) {
    return [];
  }

  return parsed.orders as StoredOrder[];
}

/**
 * Read all orders from the database
 */
export async function getAllOrders(): Promise<StoredOrder[]> {
  try {
    await ensureOrdersDatabase();
    const ordersFile = getOrdersFilePath();
    const raw = await fs.readFile(ordersFile, "utf8");
    return parseOrdersDatabase(raw);
  } catch (error) {
    console.error("Error reading orders database:", error);
    throw error;
  }
}

export async function getSubscriptionNotificationLogs(): Promise<SubscriptionNotificationLog[]> {
  try {
    await ensureOrdersDatabase();
    const parsed = JSON.parse(await fs.readFile(getNotificationLogPath(), "utf8"));
    return Array.isArray(parsed.logs) ? parsed.logs : [];
  } catch {
    return [];
  }
}

export async function appendSubscriptionNotificationLog(log: SubscriptionNotificationLog): Promise<void> {
  await ensureOrdersDatabase();
  const logs = await getSubscriptionNotificationLogs();
  logs.push(log);
  await fs.writeFile(getNotificationLogPath(), JSON.stringify({ logs }, null, 2), "utf8");
}

/**
 * Find an order by ID
 */
export async function getOrderById(orderId: string): Promise<StoredOrder | null> {
  const orders = await getAllOrders();
  return orders.find((o) => o.orderId === orderId) || null;
}

export async function getOrderByOrderNumber(orderNumber: string): Promise<StoredOrder | null> {
  const orders = await getAllOrders();
  const normalized = String(orderNumber || "").trim();
  if (!normalized) return null;
  return (
    orders.find((o) => o.orderId === normalized || o.requestId === normalized) ||
    orders.find((o) => (o.orderId || "").toLowerCase() === normalized.toLowerCase()) ||
    orders.find((o) => (o.requestId || "").toLowerCase() === normalized.toLowerCase()) ||
    null
  );
}

/**
 * Save a new order to the database
 */
export async function saveOrder(order: StoredOrder): Promise<void> {
  try {
    await ensureOrdersDatabase();
    const ordersFile = getOrdersFilePath();
    const orders = await getAllOrders();

    // Avoid duplicates
    const existingIndex = orders.findIndex((o) => o.orderId === order.orderId);
    if (existingIndex >= 0) {
      orders[existingIndex] = { ...orders[existingIndex], ...order };
    } else {
      orders.push(order);
    }

    await fs.writeFile(ordersFile, JSON.stringify({ orders, version: 1 }, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving order:", error);
    throw error;
  }
}

/**
 * Update an existing order
 */
export async function updateOrder(orderId: string, updates: Partial<StoredOrder>): Promise<StoredOrder | null> {
  try {
    await ensureOrdersDatabase();
    const ordersFile = getOrdersFilePath();
    const orders = await getAllOrders();

    const index = orders.findIndex((o) => o.orderId === orderId);
    if (index === -1) {
      return null;
    }

    orders[index] = { ...orders[index], ...updates, orderId, updatedAt: new Date().toISOString() }; // Ensure orderId is never changed
    await fs.writeFile(ordersFile, JSON.stringify({ orders, version: 1 }, null, 2), "utf8");

    return orders[index];
  } catch (error) {
    console.error("Error updating order:", error);
    throw error;
  }
}

/**
 * Get all active orders that should receive expiration notifications
 * Returns orders with status ACTIVE and expiryAt reached
 */
export async function getOrdersReadyForExpiration(): Promise<StoredOrder[]> {
  const orders = await getAllOrders();
  const now = new Date();

  return orders.filter((order) => {
    if (!order.expiryAt) {
      return false;
    }
    const effectiveStatus = order.status || "PENDING";
    if ((effectiveStatus !== "ACTIVE" && effectiveStatus !== "EXPIRING_IN_1_DAY") || order.expirationNotificationSent) {
      return false;
    }
    try {
      const expiryDate = new Date(order.expiryAt);
      return !Number.isNaN(expiryDate.getTime()) && now >= expiryDate;
    } catch {
      return false;
    }
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

/**
 * Get all paid orders grouped by status
 */
export async function getOrdersByStatus(status: OrderStatus): Promise<StoredOrder[]> {
  const orders = await getAllOrders();
  return orders.filter((o) => (o.status || "PENDING") === status);
}

export function normalizeStoredStatus(status?: string): OrderStatus {
  if (!status) return "PENDING";
  if (status === "REQUEST_SENT") return "PENDING";
  if (status === "APPROVED") return "ACTIVE";
  return ["PENDING", "ACTIVE", "EXPIRING_IN_1_DAY", "EXPIRED", "REJECTED", "CANCELLED"].includes(status)
    ? (status as OrderStatus)
    : "PENDING";
}

export async function activateOrderIfPending(orderId: string, updates: Partial<StoredOrder>): Promise<StoredOrder | null> {
  const orders = await getAllOrders();
  const index = orders.findIndex((order) => order.orderId === orderId);
  if (index === -1) {
    return null;
  }

  const current = orders[index];
  const effectiveCurrentStatus = normalizeStoredStatus(current.status);
  if (effectiveCurrentStatus !== "PENDING") {
    return null;
  }

  const updated: StoredOrder = {
    ...current,
    ...updates,
    status: "ACTIVE",
    updatedAt: new Date().toISOString(),
  };

  orders[index] = updated;
  await fs.writeFile(getOrdersFilePath(), JSON.stringify({ orders, version: 1 }, null, 2), "utf8");
  return updated;
}

/**
 * Mark an order as having received expiration notification
 */
export async function markExpirationNotificationSent(orderId: string): Promise<StoredOrder | null> {
  return updateOrder(orderId, {
    expirationNotificationSent: true,
    expirationNotificationSentAt: new Date().toISOString(),
    expiryNotificationStatus: "SENT",
    expiredAt: new Date().toISOString(),
    status: "EXPIRED",
  });
}

export async function markReminderSent(orderId: string, sentAt: string): Promise<StoredOrder | null> {
  return updateOrder(orderId, {
    reminderStatus: "SENT",
    reminderSentAt: sentAt,
    status: "EXPIRING_IN_1_DAY",
  });
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

/**
 * Check if a Canva email has already been used for a free trial
 * Email is normalized (trimmed, lowercase) for consistent comparison
 */
export async function hasFreeTrial(normalizedCanvaEmail: string): Promise<boolean> {
  const orders = await getAllOrders();
  return orders.some((order) =>
    order.paymentMethod === "Free Trial" &&
    order.canvaEmail &&
    order.canvaEmail.toLowerCase().trim() === normalizedCanvaEmail.toLowerCase().trim()
  );
}
