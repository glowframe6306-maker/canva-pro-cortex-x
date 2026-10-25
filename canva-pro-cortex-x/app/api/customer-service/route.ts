import { NextRequest, NextResponse } from "next/server";
import { generateCustomerServiceRequestId, saveCustomerServiceRequest } from "@/lib/customer-service-database";
import { getDateTimeInTimezone } from "@/lib/expiry-calculator";

const CUSTOMER_SERVICE_BOT_TOKEN = process.env.CUSTOMER_SERVICE_BOT_TOKEN;
const CUSTOMER_SERVICE_CHAT_ID = process.env.CUSTOMER_SERVICE_CHAT_ID;
const TIMEZONE = process.env.TZ || "Asia/Colombo";
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

function escapeMarkdown(text: string) {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fullName = String(body.fullName ?? "").trim();
    const whatsappNumber = String(body.whatsappNumber ?? "").trim();
    const email = String(body.email ?? "").trim();
    const canvaEmail = String(body.canvaEmail ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!fullName || !whatsappNumber || !email || !canvaEmail || !reason || !message) {
      return NextResponse.json({ ok: false, error: "Please complete all required fields." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
    }
    if (!/^[+\d][\d\s().-]{6,}$/.test(whatsappNumber)) {
      return NextResponse.json({ ok: false, error: "Please enter a valid WhatsApp number." }, { status: 400 });
    }
    if (!REASONS.has(reason)) {
      return NextResponse.json({ ok: false, error: "Please select a valid reason." }, { status: 400 });
    }
    if (!CUSTOMER_SERVICE_BOT_TOKEN || !CUSTOMER_SERVICE_CHAT_ID) {
      console.error("CUSTOMER SERVICE TELEGRAM ERROR: Customer service Telegram configuration is missing.");
      return NextResponse.json({ ok: false, error: "Unable to send your request right now. Please try again." }, { status: 503 });
    }

    const createdAt = new Date();
    const { date: createdDate, time: createdTime } = getDateTimeInTimezone(createdAt, TIMEZONE);
    const requestId = await generateCustomerServiceRequestId(createdAt);
    const serviceRequest = {
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
      status: "REQUEST_SENT" as const,
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

    const telegramResponse = await fetch(`https://api.telegram.org/bot${CUSTOMER_SERVICE_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CUSTOMER_SERVICE_CHAT_ID,
        text: escapeMarkdown(telegramMessage),
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });
    const telegramPayload = await telegramResponse.json().catch(() => ({}));
    if (!telegramResponse.ok || !telegramPayload.ok) {
      console.error("CUSTOMER SERVICE TELEGRAM ERROR:", telegramPayload.description || "Telegram delivery failed");
      return NextResponse.json({ ok: false, error: "Unable to send your request right now. Please try again." }, { status: 502 });
    }

    serviceRequest.telegramSent = true;
    await saveCustomerServiceRequest(serviceRequest);
    return NextResponse.json({ ok: true, requestId, createdDate, createdTime, status: serviceRequest.status });
  } catch (error) {
    console.error("CUSTOMER SERVICE TELEGRAM ERROR:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: "Unable to send your request right now. Please try again." }, { status: 500 });
  }
}