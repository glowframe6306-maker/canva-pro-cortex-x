/**
 * Refund request persistence and tracking
 */

import fs from "node:fs/promises";
import path from "node:path";

export type RefundStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "PROCESSED";

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
  telegramNotificationStatus?: "PENDING" | "SENT" | "FAILED";
  nextMessageStatus?: "PENDING" | "SENT" | "FAILED";
  telegramSent?: boolean;
};

const DEFAULT_PAYMENTS_DIR = path.join("C:\\Users\\Administrator\\CANVA PRO", "PAYMENTS");

function getRefundsDir(): string {
  return process.env.ORDERS_DIR || DEFAULT_PAYMENTS_DIR;
}

function getRefundRequestsFilePath(): string {
  return path.join(getRefundsDir(), ".refund-requests.json");
}

function getRefundCounterFilePath(): string {
  return path.join(getRefundsDir(), ".refund-counter.json");
}

async function ensureRefundDatabase() {
  const dir = getRefundsDir();
  const file = getRefundRequestsFilePath();
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify({ requests: [] }, null, 2), "utf8");
  }

  try {
    await fs.access(getRefundCounterFilePath());
  } catch {
    await fs.writeFile(getRefundCounterFilePath(), JSON.stringify({ count: 0 }, null, 2), "utf8");
  }
}

export function generateRefundCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "RFD-";
  for (let index = 0; index < 6; index += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

export async function generateRefundRequestId(): Promise<string> {
  await ensureRefundDatabase();
  const counterPath = getRefundCounterFilePath();
  const raw = await fs.readFile(counterPath, "utf8").catch(() => JSON.stringify({ count: 0 }));
  const parsed = JSON.parse(raw || "{\"count\":0}");
  const nextCount = Number(parsed.count || 0) + 1;
  await fs.writeFile(counterPath, JSON.stringify({ count: nextCount }, null, 2), "utf8");
  const year = new Date().getFullYear();
  return `REF-${year}-${String(nextCount).padStart(6, "0")}`;
}

export async function saveRefundRequest(request: RefundRequest): Promise<RefundRequest> {
  await ensureRefundDatabase();
  const file = getRefundRequestsFilePath();
  const raw = await fs.readFile(file, "utf8").catch(() => JSON.stringify({ requests: [] }));
  const parsed = JSON.parse(raw || "{\"requests\":[]}");
  const requests = Array.isArray(parsed.requests) ? parsed.requests : [];
  const prepared = {
    ...request,
    createdAt: request.createdAt || request.submittedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: request.status || "PENDING",
  };

  requests.push(prepared);
  await fs.writeFile(file, JSON.stringify({ requests }, null, 2), "utf8");
  return prepared;
}

export async function getAllRefundRequests(): Promise<RefundRequest[]> {
  await ensureRefundDatabase();
  const file = getRefundRequestsFilePath();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.requests) ? parsed.requests : [];
  } catch {
    return [];
  }
}

export async function getRefundRequestById(refundRequestId: string): Promise<RefundRequest | null> {
  const requests = await getAllRefundRequests();
  return requests.find((request) => request.refundRequestId === refundRequestId) || null;
}

export async function getRefundRequestByOrderNumber(orderNumber: string): Promise<RefundRequest | null> {
  const requests = await getAllRefundRequests();
  return requests.find((request) => request.orderNumber === orderNumber) || null;
}

export async function updateRefundRequestStatus(refundRequestId: string, status: RefundStatus): Promise<RefundRequest | null> {
  await ensureRefundDatabase();
  const file = getRefundRequestsFilePath();
  const raw = await fs.readFile(file, "utf8").catch(() => JSON.stringify({ requests: [] }));
  const parsed = JSON.parse(raw || "{\"requests\":[]}");
  const requests = Array.isArray(parsed.requests) ? parsed.requests : [];
  const index = requests.findIndex((request: RefundRequest) => request.refundRequestId === refundRequestId);

  if (index === -1) {
    return null;
  }

  requests[index] = { ...requests[index], status, updatedAt: new Date().toISOString() };
  await fs.writeFile(file, JSON.stringify({ requests }, null, 2), "utf8");
  return requests[index];
}

export async function hasActiveRefundRequest(orderNumber: string): Promise<boolean> {
  const request = await getRefundRequestByOrderNumber(orderNumber);
  return !!request && ["PENDING", "UNDER_REVIEW", "APPROVED"].includes(request.status);
}
