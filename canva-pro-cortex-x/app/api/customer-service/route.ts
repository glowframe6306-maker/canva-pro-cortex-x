import { NextRequest, NextResponse } from "next/server";
import { generateCustomerServiceRequestId, saveCustomerServiceRequest } from "@/lib/customer-service-database";
import { createCustomerServiceSubmissionHandler, CustomerServiceOperationError } from "@/lib/customer-service-submission";
import { getDateTimeInTimezone } from "@/lib/expiry-calculator";

const CUSTOMER_SERVICE_BOT_TOKEN = process.env.CUSTOMER_SERVICE_BOT_TOKEN;
const CUSTOMER_SERVICE_CHAT_ID = process.env.CUSTOMER_SERVICE_CHAT_ID;
const TIMEZONE = process.env.TZ || "Asia/Colombo";

const submitCustomerServiceRequest = createCustomerServiceSubmissionHandler({
  botToken: CUSTOMER_SERVICE_BOT_TOKEN,
  chatId: CUSTOMER_SERVICE_CHAT_ID,
  timeZone: TIMEZONE,
  now: () => new Date(),
  formatDateTime: getDateTimeInTimezone,
  generateRequestId: generateCustomerServiceRequestId,
  saveRequest: saveCustomerServiceRequest,
  async sendTelegram(token, chatId, text) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    return { httpOk: response.ok, payload };
  },
});

export async function POST(request: NextRequest) {
  let stage = "REQUEST";
  try {
    const body = await request.json();
    const result = await submitCustomerServiceRequest(body);
    if (result.log) {
      console.error(`CUSTOMER SERVICE ${result.log.category} ERROR:`, result.log.message);
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof CustomerServiceOperationError) {
      stage = error.category;
    }
    console.error(`CUSTOMER SERVICE ${stage} ERROR:`, error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ ok: false, error: "Unable to send your request right now. Please try again." }, { status: 500 });
  }
}