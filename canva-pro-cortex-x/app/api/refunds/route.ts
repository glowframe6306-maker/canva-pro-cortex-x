import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrderByOrderNumber, getAllOrders } from "@/lib/order-database";
import { getDateTimeInTimezone } from "@/lib/expiry-calculator";
import { buildNextMessage, buildRefundRequestMessage, escapeMarkdown } from "@/lib/telegram-messages";
import { generateRefundCode, generateRefundRequestId, saveRefundRequest, hasActiveRefundRequest } from "@/lib/refund-database";

const REFUND_BOT_TOKEN = process.env.REFUND_BOT_TOKEN;
const REFUND_CHAT_ID = process.env.REFUND_CHAT_ID;
const APP_TIMEZONE = process.env.TZ || "Asia/Colombo";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Normalize customer name for comparison
 * Handles uppercase/lowercase, extra spaces, periods
 */
function normalizeCustomerName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

/**
 * Compare two customer names with normalized format
 */
function namesMatch(submitted: string, stored: string): boolean {
  return normalizeCustomerName(submitted) === normalizeCustomerName(stored);
}

/**
 * Normalize email for comparison
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Normalize phone number for comparison
 * Handles spaces, hyphens, parentheses, country codes
 */
function normalizePhoneNumber(phone: string): string {
  let normalized = phone
    .toLowerCase()
    .trim()
    .replace(/[\s\-()]/g, "");

  // Convert 0756390621 to +94756390621 for comparison
  if (normalized.startsWith("0") && normalized.length === 10) {
    normalized = "+94" + normalized.substring(1);
  }

  return normalized;
}

/**
 * Compare two phone numbers with normalization
 */
function phonesMatch(submitted: string, stored: string): boolean {
  return normalizePhoneNumber(submitted) === normalizePhoneNumber(stored);
}

function getRefundEligibilityWindow(planType: string, startedAt: Date) {
  const candidate = new Date(startedAt);
  switch (planType) {
    case "WEEKLY":
      candidate.setDate(candidate.getDate() + 3);
      break;
    case "MONTHLY":
      candidate.setDate(candidate.getDate() + 14);
      break;
    case "YEARLY":
      candidate.setDate(candidate.getDate() + 15);
      break;
    default:
      throw new Error(`Unknown plan type for refund: ${planType}`);
  }
  return candidate;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ============================================================
    // STEP 0: Validate input format
    // ============================================================
    const orderNumber = String(body.orderNumber ?? "").trim();
    const referenceNumber = String(body.referenceNumber ?? "").trim();
    const customerName = String(body.customerName ?? "").trim();
    const email = String(body.email ?? "").trim();
    const whatsapp = String(body.whatsapp ?? "").trim();
    const canvaEmail = String(body.canvaEmail ?? "").trim();
    const refundReason = String(body.refundReason ?? "").trim();
    const additionalDetails = String(body.additionalDetails ?? "").trim();

    // Basic input validation
    if (!orderNumber) {
      return NextResponse.json({ ok: false, error: "Order number is required." }, { status: 400 });
    }
    if (!referenceNumber) {
      return NextResponse.json({ ok: false, error: "Reference number is required." }, { status: 400 });
    }
    if (!customerName) {
      return NextResponse.json({ ok: false, error: "Full name is required." }, { status: 400 });
    }
    if (!email || !isEmail(email)) {
      return NextResponse.json({ ok: false, error: "Valid email address is required." }, { status: 400 });
    }
    if (!whatsapp) {
      return NextResponse.json({ ok: false, error: "WhatsApp number is required." }, { status: 400 });
    }
    if (!canvaEmail || !isEmail(canvaEmail)) {
      return NextResponse.json({ ok: false, error: "Valid Canva email address is required." }, { status: 400 });
    }
    if (!refundReason) {
      return NextResponse.json({ ok: false, error: "Refund reason is required." }, { status: 400 });
    }
    if (refundReason === "Other" && !additionalDetails.trim()) {
      return NextResponse.json({ ok: false, error: "Additional details are required when Other is selected." }, { status: 400 });
    }

    // ============================================================
    // STEP 1: Verify Order Number exists in database
    // ============================================================
    const order = await getOrderByOrderNumber(orderNumber);
    if (!order) {
      return NextResponse.json({
        ok: false,
        error: "INVALID ORDER NUMBER",
        message: "The Order Number you entered could not be found. Please enter the correct Order Number from your original order confirmation.",
      }, { status: 404 });
    }

    // ============================================================
    // STEP 2: Load the REAL order (already done above)
    // ============================================================
    // order is now the authoritative source of truth

    // ============================================================
    // STEP 3: Verify Order Status is ACTIVE
    // ============================================================
    const orderStatus = order.status || "PENDING";
    if (orderStatus === "PENDING" || orderStatus === "REQUEST_SENT") {
      return NextResponse.json({
        ok: false,
        error: "ORDER IS STILL PENDING",
        message: "Your order has not been activated yet. A refund request can only be processed after the subscription becomes ACTIVE. Please wait until your order is activated.",
      }, { status: 400 });
    }
    if (orderStatus === "REJECTED") {
      return NextResponse.json({
        ok: false,
        error: "REFUND NOT AVAILABLE",
        message: "This order was rejected and is not eligible for this refund process.",
      }, { status: 400 });
    }
    if (orderStatus === "EXPIRED") {
      return NextResponse.json({
        ok: false,
        error: "SUBSCRIPTION EXPIRED",
        message: "This subscription has already expired and is not eligible for this refund process.",
      }, { status: 400 });
    }
    if (orderStatus !== "ACTIVE" && orderStatus !== "EXPIRING_IN_1_DAY") {
      return NextResponse.json({
        ok: false,
        error: "INVALID ORDER STATUS",
        message: "This order is not in a valid state for refund processing.",
      }, { status: 400 });
    }

    // ============================================================
    // STEP 4: Verify Customer Name matches
    // ============================================================
    const dbCustomerName = order.customerName || "";
    if (!namesMatch(customerName, dbCustomerName)) {
      return NextResponse.json({
        ok: false,
        error: "DETAILS DO NOT MATCH",
        message: "The Full Name does not match the customer details registered for this Order Number.",
      }, { status: 400 });
    }

    // ============================================================
    // STEP 5: Verify Email matches
    // ============================================================
    const dbEmail = order.customerEmail || "";
    if (normalizeEmail(email) !== normalizeEmail(dbEmail)) {
      return NextResponse.json({
        ok: false,
        error: "EMAIL DOES NOT MATCH",
        message: "The email address does not match the email registered with this Order Number.",
      }, { status: 400 });
    }

    // ============================================================
    // STEP 6: Verify WhatsApp Number matches
    // ============================================================
    const dbWhatsapp = order.customerPhone || "";
    if (dbWhatsapp && !phonesMatch(whatsapp, dbWhatsapp)) {
      return NextResponse.json({
        ok: false,
        error: "WHATSAPP NUMBER DOES NOT MATCH",
        message: "The WhatsApp number does not match the customer details registered with this Order Number.",
      }, { status: 400 });
    }

    // ============================================================
    // STEP 7: Verify Canva Email matches
    // ============================================================
    const dbCanvaEmail = order.canvaEmail || "";
    if (normalizeEmail(canvaEmail) !== normalizeEmail(dbCanvaEmail)) {
      return NextResponse.json({
        ok: false,
        error: "CANVA EMAIL DOES NOT MATCH",
        message: "The Canva Email Address does not match the email registered with this Order Number.",
      }, { status: 400 });
    }

    // ============================================================
    // STEP 8: Verify Reference Number belongs to this Order Number
    // ============================================================
    const dbReferenceNumber = order.requestId || order.orderId || "";
    if (referenceNumber !== dbReferenceNumber && referenceNumber !== "") {
      // Check if reference belongs to a different order
      const allOrders = await getAllOrders();
      const belongsToAnotherOrder = allOrders.some(
        (o) => (o.requestId === referenceNumber || o.orderId === referenceNumber) && o.orderId !== orderNumber
      );
      if (belongsToAnotherOrder) {
        return NextResponse.json({
          ok: false,
          error: "REFERENCE NUMBER DOES NOT MATCH",
          message: "The Reference Number does not belong to the Order Number you entered.",
        }, { status: 400 });
      }
    }

    // ============================================================
    // STEP 9: Order-based Consistency Check
    // ============================================================
    // All submitted values must resolve to the SAME database order
    // This is implicitly verified by the previous checks
    if (order.orderId !== orderNumber) {
      return NextResponse.json({
        ok: false,
        error: "VALIDATION ERROR",
        message: "The submitted order details do not resolve to a single consistent record.",
      }, { status: 400 });
    }

    // ============================================================
    // STEP 10: Final ACTIVE Check (before eligibility window)
    // ============================================================
    // Verify order is still ACTIVE in database (race condition protection)
    const finalOrderCheck = await getOrderByOrderNumber(orderNumber);
    if (!finalOrderCheck || (finalOrderCheck.status && finalOrderCheck.status !== "ACTIVE" && finalOrderCheck.status !== "EXPIRING_IN_1_DAY")) {
      return NextResponse.json({
        ok: false,
        error: "ORDER STATUS CHANGED",
        message: "The order status has changed. Please verify your order and try again.",
      }, { status: 400 });
    }

    // ============================================================
    // STEP 11: Verify Refund Eligibility (not free trial)
    // ============================================================
    if (order.paymentMethod === "Free Trial") {
      return NextResponse.json({
        ok: false,
        error: "NOT ELIGIBLE",
        message: "Free Trial subscriptions are not eligible for refunds.",
      }, { status: 400 });
    }

    // ============================================================
    // STEP 12: Verify Plan Type is eligible for refund
    // ============================================================
    const resolvedPlanType = order.planType || (order.selectedPlan ? String(order.selectedPlan).toUpperCase() : "") || "";
    const normalizedPlanType = ["WEEKLY", "MONTHLY", "YEARLY"].includes(resolvedPlanType)
      ? (resolvedPlanType as "WEEKLY" | "MONTHLY" | "YEARLY")
      : "" as "WEEKLY" | "MONTHLY" | "YEARLY";
    if (!normalizedPlanType) {
      return NextResponse.json({
        ok: false,
        error: "PLAN NOT ELIGIBLE",
        message: "This subscription plan is not eligible for refunds.",
      }, { status: 400 });
    }

    // ============================================================
    // STEP 13: Verify subscription start date is valid
    // ============================================================
    const baseStart = order.activatedAt ? new Date(order.activatedAt) : new Date(order.orderCreatedAt || order.createdAt || order.requestReceivedAt || Date.now());
    if (Number.isNaN(baseStart.getTime())) {
      return NextResponse.json({
        ok: false,
        error: "VALIDATION ERROR",
        message: "Unable to verify the subscription start date.",
      }, { status: 400 });
    }

    // ============================================================
    // STEP 14: Check Refund Eligibility Window
    // ============================================================
    const refundEligibleUntil = getRefundEligibilityWindow(normalizedPlanType, baseStart);
    const submittedAt = new Date();
    if (submittedAt > refundEligibleUntil) {
      const { date: eligibleUntilDate, time: eligibleUntilTime } = getDateTimeInTimezone(refundEligibleUntil, APP_TIMEZONE);
      return NextResponse.json({
        ok: false,
        error: "REFUND PERIOD EXPIRED",
        message: `Your subscription is outside the allowed refund period. The refund period ended on ${eligibleUntilDate} at ${eligibleUntilTime}. Therefore, the refund request cannot be processed through this refund policy.`,
      }, { status: 400 });
    }

    // ============================================================
    // STEP 15: Check for Duplicate Refund Request
    // ============================================================
    const hasExisting = await hasActiveRefundRequest(orderNumber);
    if (hasExisting) {
      return NextResponse.json({
        ok: false,
        error: "REFUND REQUEST ALREADY EXISTS",
        message: "A refund request has already been submitted for this Order Number.",
      }, { status: 400 });
    }

    // ============================================================
    // ALL VALIDATION PASSED - Create Refund Request
    // ============================================================
    const refundRequestId = await generateRefundRequestId();
    const refundCode = generateRefundCode();
    const { date: startedDate, time: startedTime } = getDateTimeInTimezone(baseStart, APP_TIMEZONE);
    const expiresAt = order.expiryAt ? new Date(order.expiryAt) : new Date(baseStart.getTime());
    const { date: expiresDate, time: expiresTime } = getDateTimeInTimezone(expiresAt, APP_TIMEZONE);
    const { date: refundEligibleDate, time: refundEligibleTime } = getDateTimeInTimezone(refundEligibleUntil, APP_TIMEZONE);
    const { date: submittedDate, time: submittedTime } = getDateTimeInTimezone(submittedAt, APP_TIMEZONE);

    const requestedRefundAmount = Number(order.planPrice || 0) || 0;

    const refundRequest = {
      refundRequestId,
      refundCode,
      orderNumber,
      referenceNumber: dbReferenceNumber,
      customerName: dbCustomerName,
      email: dbEmail,
      whatsapp: dbWhatsapp,
      canvaEmail: dbCanvaEmail,
      refundReason,
      additionalDetails: additionalDetails || "None",
      originalPlan: order.selectedPlan,
      originalPlanType: normalizedPlanType,
      originalPaidAmount: Number(order.planPrice || 0) || 0,
      requestedRefundAmount,
      startedAt: order.activatedAt || order.orderCreatedAt || order.createdAt || new Date().toISOString(),
      startedDate,
      startedTime,
      expiresAt: order.expiryAt || expiresAt.toISOString(),
      expiresDate,
      expiresTime,
      refundEligibleUntil: refundEligibleUntil.toISOString(),
      refundEligibleUntilDate: refundEligibleDate,
      refundEligibleUntilTime: refundEligibleTime,
      orderCreatedAt: order.orderCreatedAt || order.createdAt || new Date().toISOString(),
      subscriptionStartedAt: order.activatedAt || baseStart.toISOString(),
      subscriptionExpiresAt: order.expiryAt || expiresAt.toISOString(),
      activationStatus: "ACTIVE",
      orderStatus: "ACTIVE",
      paymentStatus: order.paymentMethod === "Bank Transfer" ? "PAID" : "PENDING",
      plan: order.selectedPlan || normalizedPlanType,
      paidAmount: Number(order.planPrice || 0) || 0,
      submittedAt: submittedAt.toISOString(),
      createdAt: submittedAt.toISOString(),
      updatedAt: submittedAt.toISOString(),
      status: "PENDING" as const,
      telegramNotificationStatus: "PENDING" as const,
      nextMessageStatus: "PENDING" as const,
      telegramSent: false,
    };

    const saved = await saveRefundRequest(refundRequest);

    // ============================================================
    // STEP 16: Send to Telegram Bot ONLY after all checks pass
    // ============================================================
    if (!REFUND_BOT_TOKEN || !REFUND_CHAT_ID) {
      return NextResponse.json({
        ok: true,
        refundRequestId: saved.refundRequestId,
        refundCode: saved.refundCode,
        status: saved.status,
        message: "Refund request recorded. Telegram notification is not configured yet.",
      }, { status: 202 });
    }

    const message = buildRefundRequestMessage(saved);
    const telegramResponse = await fetch(`https://api.telegram.org/bot${REFUND_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: REFUND_CHAT_ID,
        text: escapeMarkdown(message),
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });
    const payload = await telegramResponse.json().catch(() => ({}));

    // ============================================================
    // STEP 17: Telegram Failure Handling
    // ============================================================
    if (!telegramResponse.ok || !payload.ok) {
      console.error("REFUND TELEGRAM ERROR:", payload.description || "Refund notification failed");
      return NextResponse.json({
        ok: false,
        error: "REFUND REQUEST COULD NOT BE SENT",
        message: "The refund request could not be submitted at this time. Please try again later.",
        refundRequestId: saved.refundRequestId,
        retryable: true,
      }, { status: 503 });
    }

    // Send follow-up message
    const nextMessage = buildNextMessage();
    await fetch(`https://api.telegram.org/bot${REFUND_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: REFUND_CHAT_ID,
        text: escapeMarkdown(nextMessage),
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    }).catch((error) => {
      console.error("REFUND NEXT MESSAGE ERROR:", error);
      // Don't fail if follow-up message fails
    });

    // ============================================================
    // STEP 18: Success Response
    // ============================================================
    return NextResponse.json({
      ok: true,
      refundRequestId: saved.refundRequestId,
      refundCode: saved.refundCode,
      orderNumber: saved.orderNumber,
      referenceNumber: saved.referenceNumber,
      plan: saved.plan || saved.originalPlan || "N/A",
      status: saved.status,
      message: "Refund request submitted successfully.",
      createdAt: saved.createdAt,
    }, { status: 200 });
  } catch (error) {
    console.error("REFUND API ERROR:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({
      ok: false,
      error: "Unable to process refund request.",
      message: "An unexpected error occurred. Please try again later.",
    }, { status: 500 });
  }
}
