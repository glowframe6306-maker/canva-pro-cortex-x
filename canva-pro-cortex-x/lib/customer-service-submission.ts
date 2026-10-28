import type { CustomerServiceRequest } from "@/lib/customer-service-store";

const REASONS = new Set([
  "Account / Access Issue",
  "Payment Issue",
  "Canva Pro Issue",
  "Free Trial Issue",
  "Order Issue",
  "Technical Issue",
  "Customer Service",
  "Other",
]);

type TelegramResult = { httpOk: boolean; payload: unknown };
type SubmissionResponse = {
  status: number;
  body: Record<string, unknown>;
  log?: { category: "TELEGRAM" | "PERSISTENCE"; message: string };
};

type CustomerServiceDependencies = {
  botToken?: string;
  chatId?: string;
  timeZone: string;
  now: () => Date;
  formatDateTime: (date: Date, timeZone: string) => { date: string; time: string };
  generateRequestId: (date: Date, timeZone: string) => Promise<string>;
  saveRequest: (request: CustomerServiceRequest) => Promise<void>;
  sendTelegram: (token: string, chatId: string, text: string) => Promise<TelegramResult>;
};

export class CustomerServiceOperationError extends Error {
  readonly category: "TELEGRAM" | "PERSISTENCE";

  constructor(category: "TELEGRAM" | "PERSISTENCE", cause: unknown) {
    super("Customer service request processing failed.", { cause });
    this.name = "CustomerServiceOperationError";
    this.category = category;
  }
}

function escapeMarkdown(text: string) {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

function getStringField(body: unknown, key: string): string {
  if (!body || typeof body !== "object" || !(key in body)) return "";
  return String((body as Record<string, unknown>)[key] ?? "").trim();
}

export function createCustomerServiceSubmissionHandler(dependencies: CustomerServiceDependencies) {
  return async (body: unknown): Promise<SubmissionResponse> => {
    const fullName = getStringField(body, "fullName");
    const whatsappNumber = getStringField(body, "whatsappNumber");
    const email = getStringField(body, "email");
    const canvaEmail = getStringField(body, "canvaEmail");
    const reason = getStringField(body, "reason");
    const message = getStringField(body, "message");

    if (!fullName || !whatsappNumber || !email || !canvaEmail || !reason || !message) {
      return { status: 400, body: { ok: false, error: "Please complete all required fields." } };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { status: 400, body: { ok: false, error: "Please enter a valid email address." } };
    }
    if (!/^[+\d][\d\s().-]{6,}$/.test(whatsappNumber)) {
      return { status: 400, body: { ok: false, error: "Please enter a valid WhatsApp number." } };
    }
    if (!REASONS.has(reason)) {
      return { status: 400, body: { ok: false, error: "Please select a valid reason." } };
    }
    if (!dependencies.botToken || !dependencies.chatId) {
      return {
        status: 503,
        body: { ok: false, error: "Unable to send your request right now. Please try again." },
        log: { category: "TELEGRAM", message: "Customer service Telegram configuration is missing." },
      };
    }

    const createdAt = dependencies.now();
    const { date: createdDate, time: createdTime } = dependencies.formatDateTime(createdAt, dependencies.timeZone);
    let requestId: string;
    try {
      requestId = await dependencies.generateRequestId(createdAt, dependencies.timeZone);
    } catch (error) {
      throw new CustomerServiceOperationError("PERSISTENCE", error);
    }

    const serviceRequest: CustomerServiceRequest = {
      requestId,
      fullName,
      whatsappNumber,
      email,
      canvaEmail,
      reason,
      message,
      createdAt: createdAt.toISOString(),
      createdDate,
      createdTime,
      status: "REQUEST_SENT",
      telegramSent: false,
    };
    const telegramMessage = [
      "🎧 NEW CUSTOMER SERVICE REQUEST",
      "",
      `🆔 Request ID: ${requestId}`,
      "",
      `👤 Full Name: ${fullName}`,
      `📱 WhatsApp Number: ${whatsappNumber}`,
      `📧 Email Address: ${email}`,
      `🎨 Canva Email Address: ${canvaEmail}`,
      `📋 Reason: ${reason}`,
      `📝 Message / Details: ${message}`,
      "",
      `📅 Date: ${createdDate}`,
      `⏲️ Time: ${createdTime}`,
      "",
      "📦 Status: REQUEST_SENT",
    ].join("\n");

    let telegramResult: TelegramResult;
    try {
      telegramResult = await dependencies.sendTelegram(
        dependencies.botToken,
        dependencies.chatId,
        escapeMarkdown(telegramMessage),
      );
    } catch (error) {
      throw new CustomerServiceOperationError("TELEGRAM", error);
    }

    const payload = telegramResult.payload;
    const telegramAccepted = !!payload
      && typeof payload === "object"
      && "ok" in payload
      && (payload as { ok?: unknown }).ok === true;
    if (!telegramResult.httpOk || !telegramAccepted) {
      const description = payload && typeof payload === "object" && "description" in payload
        ? String((payload as { description?: unknown }).description || "Telegram delivery failed")
        : "Telegram delivery failed";
      return {
        status: 502,
        body: { ok: false, error: "Unable to send your request right now. Please try again." },
        log: { category: "TELEGRAM", message: description },
      };
    }

    serviceRequest.telegramSent = true;
    try {
      await dependencies.saveRequest(serviceRequest);
    } catch (error) {
      throw new CustomerServiceOperationError("PERSISTENCE", error);
    }
    return {
      status: 200,
      body: { ok: true, requestId, createdDate, createdTime, status: serviceRequest.status },
    };
  };
}
