import { createHash } from "node:crypto";

export type DeliveryStatus = "PENDING" | "SENDING" | "SENT" | "FAILED" | "UNKNOWN";

export type IdempotencyAction = "deliver" | "already-delivered" | "in-progress" | "manual-reconciliation";
export type OrderSubmissionErrorCategory =
  | "DATABASE_CONFIGURATION"
  | "DATABASE"
  | "FILESYSTEM"
  | "APPLICATION_CONFIGURATION"
  | "UNKNOWN";

export type SafeOrderSubmissionDiagnostic = {
  category: OrderSubmissionErrorCategory;
  errorName: string;
  code?: string;
};

export function getMissingOrderFields(
  isTrial: boolean,
  fields: Record<string, unknown>,
): string[] {
  const required = isTrial
    ? ["customerName", "customerEmail", "customerPhone", "canvaEmail"]
    : [
      "customerName",
      "customerPhone",
      "customerEmail",
      "selectedPlan",
      "planPrice",
      "paymentMethod",
      "paymentDetails",
      "orderDate",
    ];
  return required.filter((field) => !String(fields[field] ?? "").trim());
}

export function isOrderSubmissionDelivered(
  isTrial: boolean,
  telegramStatus: DeliveryStatus,
  receiptStatus: DeliveryStatus,
): boolean {
  return telegramStatus === "SENT" && (isTrial || receiptStatus === "SENT");
}

export function classifyTelegramResponse(httpOk: boolean, payload: unknown): "SENT" | "FAILED" | "UNKNOWN" {
  const apiOk = payload && typeof payload === "object" && "ok" in payload
    ? payload.ok
    : undefined;
  if (httpOk && apiOk === true) return "SENT";
  if (apiOk === false) return "FAILED";
  return "UNKNOWN";
}

export function getIdempotencyAction(status: DeliveryStatus): IdempotencyAction {
  if (status === "SENT") return "already-delivered";
  if (status === "PENDING" || status === "FAILED") return "deliver";
  if (status === "SENDING") return "in-progress";
  return "manual-reconciliation";
}

export function getSafeOrderSubmissionDiagnostic(error: unknown): SafeOrderSubmissionDiagnostic {
  if (!(error instanceof Error)) {
    return { category: "UNKNOWN", errorName: "UnknownError" };
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  const safeCode = code === "ENOENT" || (code && /^[0-9A-Z]{5}$/.test(code)) ? code : undefined;
  const safeCodeField = safeCode ? { code: safeCode } : {};
  const errorName = [
    "Error",
    "TypeError",
    "SyntaxError",
    "RangeError",
    "MissingApplicationSettingError",
    "InvalidApplicationSettingError",
    "NeonDbError",
    "PostgresError",
    "FetchError",
    "AbortError",
  ].includes(error.name) ? error.name : "Error";

  if (error.message === "PostgreSQL is not configured. Set POSTGRES_URL or DATABASE_URL.") {
    return { category: "DATABASE_CONFIGURATION", errorName };
  }
  if (errorName === "MissingApplicationSettingError" || errorName === "InvalidApplicationSettingError") {
    return { category: "APPLICATION_CONFIGURATION", errorName };
  }
  if (code === "ENOENT") {
    return { category: "FILESYSTEM", errorName, ...safeCodeField };
  }
  if (errorName === "NeonDbError" || errorName === "PostgresError" || (code && /^[0-9A-Z]{5}$/.test(code))) {
    return { category: "DATABASE", errorName, ...safeCodeField };
  }
  return { category: "UNKNOWN", errorName, ...safeCodeField };
}

export function getTelegramErrorCode(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object" || !("error_code" in payload)) return undefined;
  const errorCode = payload.error_code;
  return typeof errorCode === "number" && Number.isInteger(errorCode) ? errorCode : undefined;
}

export function getMissingTelegramConfiguration(
  isTrial: boolean,
  hasBotToken: boolean,
  hasChatId: boolean,
): string[] {
  const missing: string[] = [];
  if (!hasBotToken) missing.push(isTrial ? "FREE_TRIAL_BOT_TOKEN" : "TELEGRAM_BOT_TOKEN");
  if (!hasChatId) missing.push(isTrial ? "FREE_TRIAL_CHAT_ID" : "TELEGRAM_CHAT_ID");
  return missing;
}

export function hashOrderSubmission(fields: Array<[string, string]>, receipt?: Buffer): string {
  const hash = createHash("sha256");
  const sortedFields = fields
    .filter(([key]) => key !== "orderDate")
    .sort(([left], [right]) => left.localeCompare(right));

  for (const [key, value] of sortedFields) {
    hash.update(`${key.length}:${key}${value.length}:${value}`);
  }
  if (receipt) hash.update(receipt);

  return hash.digest("hex");
}
