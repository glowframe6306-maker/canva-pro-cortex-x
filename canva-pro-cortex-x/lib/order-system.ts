import path from "node:path";
import { resolveApplicationTimezone } from "@/lib/expiry-calculator";
import { getNextOrderCounter } from "@/lib/order-database";
import { getPostgresClient } from "@/lib/postgres";

export type ReceiptStorageResult = {
  filename: string;
  storageKey: string;
  path: string;
  saved: boolean;
  reason?: string;
};

function getFileExtension(fileName: string, mimeType?: string) {
  const extFromName = path.extname(fileName || "").toLowerCase();
  if (extFromName) return extFromName;

  const mapped: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf",
  };

  return mapped[mimeType || ""] || ".jpg";
}

export async function generateOrderNumber() {
  const dateStamp = getDateStamp();
  const nextValue = await getNextOrderCounter("MI", dateStamp);
  return `MI-${dateStamp}-${String(nextValue).padStart(4, "0")}`;
}

export async function generateFreeTrialRequestId() {
  const dateStamp = getDateStamp();
  const nextValue = await getNextOrderCounter("FT", dateStamp);
  return `FT-${dateStamp}-${String(nextValue).padStart(4, "0")}`;
}

function getDateStamp() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: resolveApplicationTimezone(),
  }).format(new Date()).replace(/-/g, "");
}

export async function saveReceiptFile(file: { name: string; type: string; buffer: Buffer }, orderId: string): Promise<ReceiptStorageResult> {
  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return {
      filename: `${orderId}${getFileExtension(file.name, file.type)}`,
      storageKey: `${orderId}${getFileExtension(file.name, file.type)}`,
      path: "",
      saved: false,
      reason: "Unsupported receipt file type.",
    };
  }

  const targetExtension = getFileExtension(file.name, file.type);
  const targetFilename = `${orderId}${targetExtension}`;

  await getPostgresClient().query(
    `INSERT INTO order_receipts (order_id, filename, mime_type, content)
     VALUES ($1, $2, $3, decode($4, 'base64'))
     ON CONFLICT (order_id) DO UPDATE SET
       filename = EXCLUDED.filename,
       mime_type = EXCLUDED.mime_type,
       content = EXCLUDED.content`,
    [orderId, targetFilename, file.type, file.buffer.toString("base64")],
  );

  return {
    filename: targetFilename,
    storageKey: targetFilename,
    path: `/api/admin/orders/${encodeURIComponent(orderId)}/receipt`,
    saved: true,
  };
}

export async function getReceiptFile(orderId: string): Promise<{ filename: string; mimeType: string; buffer: Buffer } | null> {
  const rows = await getPostgresClient().query(
    `SELECT filename, mime_type, encode(content, 'base64') AS content_base64
     FROM order_receipts WHERE order_id = $1 LIMIT 1`,
    [orderId],
  ) as Array<{ filename: string; mime_type: string; content_base64: string }>;
  const receipt = rows[0];
  if (!receipt) return null;
  return {
    filename: receipt.filename,
    mimeType: receipt.mime_type,
    buffer: Buffer.from(receipt.content_base64, "base64"),
  };
}

export function formatOrderNumberLabel(orderId: string) {
  return orderId || "Order pending";
}

export function resolveReceiptMime(fileName: string, fileType: string) {
  if (fileType === "image/png") return "image/png";
  if (fileType === "image/jpeg" || fileType === "image/jpg") return "image/jpeg";
  if (fileType === "application/pdf") return "application/pdf";
  return fileType || (path.extname(fileName).toLowerCase() === ".pdf" ? "application/pdf" : "image/jpeg");
}

export function isProductionWithoutStorage() {
  return process.env.NODE_ENV === "production" && !(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}
