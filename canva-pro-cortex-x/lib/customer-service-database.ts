import fs from "node:fs/promises";
import path from "node:path";

export type CustomerServiceRequest = {
  requestId: string;
  fullName: string;
  whatsappNumber: string;
  email: string;
  canvaEmail: string;
  reason: string;
  message: string;
  createdAt: string;
  createdDate: string;
  createdTime: string;
  status: "REQUEST_SENT";
  telegramSent: boolean;
};

const DEFAULT_DIRECTORY = path.join("C:\\Users\\Administrator\\CANVA PRO", "PAYMENTS");

function getDirectory() {
  return process.env.CUSTOMER_SERVICE_DATA_DIR || DEFAULT_DIRECTORY;
}

function getRequestsPath() {
  return path.join(getDirectory(), ".customer-service-requests.json");
}

function getCounterPath() {
  return path.join(getDirectory(), ".customer-service-counter.json");
}

async function ensureStore() {
  await fs.mkdir(getDirectory(), { recursive: true });
  try {
    await fs.access(getRequestsPath());
  } catch {
    await fs.writeFile(getRequestsPath(), JSON.stringify({ requests: [], version: 1 }, null, 2), "utf8");
  }
}

export async function getCustomerServiceRequests(): Promise<CustomerServiceRequest[]> {
  await ensureStore();
  const parsed = JSON.parse(await fs.readFile(getRequestsPath(), "utf8"));
  return Array.isArray(parsed.requests) ? parsed.requests : [];
}

export async function saveCustomerServiceRequest(request: CustomerServiceRequest) {
  await ensureStore();
  const requests = await getCustomerServiceRequests();
  requests.push(request);
  await fs.writeFile(getRequestsPath(), JSON.stringify({ requests, version: 1 }, null, 2), "utf8");
}

export async function generateCustomerServiceRequestId(date: Date) {
  await ensureStore();
  let last = 0;
  try {
    last = Number(JSON.parse(await fs.readFile(getCounterPath(), "utf8")).last || 0);
  } catch {
    last = 0;
  }
  const next = last + 1;
  await fs.writeFile(getCounterPath(), JSON.stringify({ last: next }), "utf8");
  const dateStamp = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: process.env.TZ || "Asia/Colombo",
  }).format(date).replace(/-/g, "");
  return `CS-${dateStamp}-${String(next).padStart(4, "0")}`;
}