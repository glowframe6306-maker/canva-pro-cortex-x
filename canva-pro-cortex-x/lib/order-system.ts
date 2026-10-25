import fs from "node:fs/promises";
import path from "node:path";

export type ReceiptStorageResult = {
  filename: string;
  storageKey: string;
  path: string;
  saved: boolean;
  reason?: string;
};

const DEFAULT_LOCAL_PAYMENT_DIR = path.join("C:\\Users\\Administrator\\CANVA PRO", "PAYMENTS");

const isProductionWithPersistentStorage = () =>
  process.env.NODE_ENV === "production" && !!(process.env.PERSISTENT_STORAGE_PATH || process.env.UPLOADS_DIR);

function getLocalPaymentDir() {
  return process.env.LOCAL_PAYMENT_DIR || DEFAULT_LOCAL_PAYMENT_DIR;
}

function getPersistentStorageDir() {
  return process.env.PERSISTENT_STORAGE_PATH || process.env.UPLOADS_DIR || "";
}

async function ensureDirectory(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

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

async function readOrderCounter(storageDir: string) {
  const counterPath = path.join(storageDir, ".order-counter.json");
  try {
    const raw = await fs.readFile(counterPath, "utf8");
    const parsed = JSON.parse(raw);
    return Number(parsed.last || 0);
  } catch {
    return 0;
  }
}

async function writeOrderCounter(storageDir: string, value: number) {
  const counterPath = path.join(storageDir, ".order-counter.json");
  await fs.writeFile(counterPath, JSON.stringify({ last: value }), "utf8");
}

export async function generateOrderNumber() {
  const dateStamp = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: process.env.TZ || "Asia/Colombo",
  }).format(new Date()).replace(/-/g, "");

  if (process.env.NODE_ENV !== "production" || getPersistentStorageDir()) {
    const storageDir = getPersistentStorageDir() || getLocalPaymentDir();
    await ensureDirectory(storageDir);

    const lastValue = await readOrderCounter(storageDir);
    const nextValue = lastValue + 1;
    await writeOrderCounter(storageDir, nextValue);

    return `MI-${dateStamp}-${String(nextValue).padStart(4, "0")}`;
  }

  const runtimeCounter = (globalThis as typeof globalThis & { __micortexOrderCounter?: number }).__micortexOrderCounter ?? 0;
  const nextValue = runtimeCounter + 1;
  (globalThis as typeof globalThis & { __micortexOrderCounter?: number }).__micortexOrderCounter = nextValue;

  return `MI-${dateStamp}-${String(nextValue).padStart(4, "0")}`;
}

export async function generateFreeTrialRequestId() {
  const storageDir = getPersistentStorageDir() || getLocalPaymentDir();
  await ensureDirectory(storageDir);
  const counterPath = path.join(storageDir, ".free-trial-counter.json");
  let lastValue = 0;
  try {
    lastValue = Number(JSON.parse(await fs.readFile(counterPath, "utf8")).last || 0);
  } catch {
    lastValue = 0;
  }
  const nextValue = lastValue + 1;
  await fs.writeFile(counterPath, JSON.stringify({ last: nextValue }), "utf8");
  const dateStamp = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: process.env.TZ || "Asia/Colombo",
  }).format(new Date()).replace(/-/g, "");
  return `FT-${dateStamp}-${String(nextValue).padStart(4, "0")}`;
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

  const storageDir = getPersistentStorageDir() || getLocalPaymentDir();
  if (process.env.NODE_ENV === "production" && !getPersistentStorageDir()) {
    return {
      filename: targetFilename,
      storageKey: targetFilename,
      path: "",
      saved: false,
      reason: "No persistent production upload storage configured.",
    };
  }

  await ensureDirectory(storageDir);
  const targetPath = path.join(storageDir, targetFilename);
  await fs.writeFile(targetPath, file.buffer);

  return {
    filename: targetFilename,
    storageKey: targetFilename,
    path: targetPath,
    saved: true,
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
  return process.env.NODE_ENV === "production" && !getPersistentStorageDir();
}
