import { NextRequest, NextResponse } from "next/server";
import {
  classifyTelegramResponse,
  escapeOrderTelegramMessage,
  getMissingOrderFields,
  getIdempotencyAction,
  getMissingTelegramConfiguration,
  getSafeOrderSubmissionDiagnostic,
  hashOrderSubmission,
  isOrderSubmissionDelivered,
  sendTelegramMessage,
} from "@/lib/order-submission";
import path from "node:path";
import { generateFreeTrialRequestId, generateOrderNumber, resolveReceiptMime, saveReceiptFile } from "@/lib/order-system";
import { getDateTimeInTimezone, calculateExpiry, getPlanDurationDisplay, planNameToPlanType } from "@/lib/expiry-calculator";
import {
  claimDelivery,
  createOrderIdempotently,
  getOrderByIdempotencyKey,
  getOrderSnapshot,
  hasFreeTrial,
  IdempotencyConflictError,
  markOrderNextMessageSent,
  markTrialNextMessageSent,
  setDeliveryStatus,
} from "@/lib/order-database";
import { buildNewOrderMessage, buildTrialRequestMessage, buildNextMessage } from "@/lib/telegram-messages";
import type { StoredOrder } from "@/lib/order-database";
import { resolvePlanPricing } from "@/lib/pricing";
import { getOrderPricingFields } from "@/lib/order-pricing";
import { incrementPromoUsage } from "@/lib/site-settings";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const FREE_TRIAL_BOT_TOKEN = process.env.FREE_TRIAL_BOT_TOKEN;
const FREE_TRIAL_CHAT_ID = process.env.FREE_TRIAL_CHAT_ID;
function normalizePhone(phone: string) {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.startsWith("00") ? `+${cleaned.slice(2)}` : cleaned;
}

function buildWhatsAppUrl(order: StoredOrder) {
  const phone = normalizePhone(String(order.customerPhone || ""));
  const text = [
    "MI CORTEX X INC. — NEW ORDER",
    "",
    `Order Number: ${order.orderId}`,
    "",
    `Customer: ${order.customerName}`,
    `WhatsApp: ${phone || order.customerPhone || "N/A"}`,
    `Plan: ${order.selectedPlan}`,
    `Price: ${order.planPrice}`,
    `Payment Method: ${order.paymentMethod}`,
    `Payment Reference: ${order.paymentDetails}`,
    "",
    `Payment Receipt: ${order.receiptFilename || "N/A"}`,
  ].join("\n");

  const encodedText = encodeURIComponent(text);
  const whatsappNumber = "94756390621";
  return `https://wa.me/${whatsappNumber}?text=${encodedText}`;
}

function buildSuccessResponse(order: StoredOrder, isTrial: boolean) {
  const response: Record<string, unknown> = {
    ok: true,
    orderId: order.orderId,
    orderNumber: order.orderId,
    requestId: order.requestId,
    referenceNumber: order.paymentDetails || "",
    isTrial,
    message: isTrial ? "Free trial request submitted successfully." : "Order submitted successfully.",
  };

  if (!isTrial) {
    response.receiptFilename = order.receiptFilename;
    response.receiptPath = order.receiptPath;
    response.storageKey = order.storageKey;
    response.whatsappUrl = buildWhatsAppUrl(order);
  } else {
    response.trialEndDate = order.trialEndDate;
    response.trialEndTime = order.trialEndTime;
  }

  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries());

    const paymentMethod = String(body.paymentMethod || "").trim();
    const isTrial = paymentMethod === "Free Trial";

    const missingFields = getMissingOrderFields(isTrial, body);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { ok: false, error: isTrial ? "Please fill in all required fields." : "Missing required order information." },
        { status: 400 }
      );
    }

    const idempotencyKey = request.headers.get("Idempotency-Key") || "";
    if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
      return NextResponse.json({ ok: false, error: "Please retry the order submission." }, { status: 400 });
    }

    const customerName = String(body.customerName || "").trim();
    const customerEmail = String(body.customerEmail || "").trim();
    const canvaEmail = String(body.canvaEmail || "").trim().toLowerCase();
    const customerPhone = String(body.customerPhone || "").trim();
    const selectedPlan = String(body.selectedPlan || "").trim();
    const paymentDetails = String(body.paymentDetails || "").trim();
    const selectedPlanKey = String(selectedPlan || "").trim().toLowerCase();
    const enteredPromoCode = String(body.promoCode || body.promo || "").trim();
    const priceState = await resolvePlanPricing(selectedPlanKey, enteredPromoCode || undefined);
    const orderDateValue = new Date();
    const serverDateTime = getDateTimeInTimezone(orderDateValue);
    const orderDate = String(body.orderDate || orderDateValue.toISOString()).trim();
    const additionalInfo = String(body.additionalInfo || "").trim();
    const originalReceiptName = String(body.receiptName || "").trim();
    const receiptFile = formData.get("receipt");
    let fileBuffer: Buffer | null = null;
    if (!isTrial && receiptFile && typeof receiptFile !== "string") {
      fileBuffer = Buffer.from(await receiptFile.arrayBuffer());
    }

    const idempotencyFields = Array.from(formData.entries())
      .filter((entry): entry is [string, string] => typeof entry[1] === "string");
    const payloadHash = hashOrderSubmission(idempotencyFields, fileBuffer || undefined);
    const existingSubmission = await getOrderByIdempotencyKey(idempotencyKey);
    if (existingSubmission) {
      if (existingSubmission.payloadHash !== payloadHash) {
        return NextResponse.json(
          { ok: false, error: "This submission has changed. Please submit it again." },
          { status: 409 },
        );
      }
      const action = getIdempotencyAction(existingSubmission.telegramDeliveryStatus);
      if (action === "already-delivered") {
        if (isOrderSubmissionDelivered(
          isTrial,
          existingSubmission.telegramDeliveryStatus,
          existingSubmission.receiptDeliveryStatus,
        )) {
          return buildSuccessResponse(existingSubmission.order, isTrial);
        }
      } else if (action === "in-progress") {
        return NextResponse.json(
          { ok: false, error: "Your order is still being processed. Please retry shortly." },
          { status: 409 },
        );
      } else if (action === "manual-reconciliation") {
        return NextResponse.json(
          { ok: false, error: "We could not confirm delivery. Please contact support before retrying." },
          { status: 409 },
        );
      }
    }

    // Check for free trial duplicates (server-side, before any other processing)
    if (isTrial && !existingSubmission) {
      const trialExists = await hasFreeTrial(canvaEmail);
      if (trialExists) {
        return NextResponse.json(
          {
            ok: false,
            error: "This Canva email address has already been used for a free trial. Each Canva email account can receive the 3-day free trial only once.",
            isDuplicate: true,
          },
          { status: 400 }
        );
      }
    }

    const orderId = existingSubmission?.order.orderId || await generateOrderNumber();
    const requestId = existingSubmission?.order.requestId || (isTrial ? await generateFreeTrialRequestId() : undefined);
    const requestPlanType = isTrial ? planNameToPlanType("FREE_TRIAL") : planNameToPlanType(selectedPlan);
    const paidRequestExpiry = requestPlanType ? calculateExpiry(requestPlanType, orderDateValue) : null;
    const trialRequestExpiry = isTrial ? new Date(orderDateValue) : null;
    if (trialRequestExpiry) {
      trialRequestExpiry.setDate(trialRequestExpiry.getDate() + 3);
    }
    const requestExpiryDateTime = paidRequestExpiry
      ? { date: paidRequestExpiry.expiryDate, time: paidRequestExpiry.expiryTime, at: paidRequestExpiry.expiryAt }
      : trialRequestExpiry
        ? { ...getDateTimeInTimezone(trialRequestExpiry), at: trialRequestExpiry.toISOString() }
        : null;

    if (!requestExpiryDateTime) {
      return NextResponse.json({ ok: false, error: "Unable to calculate order expiry." }, { status: 500 });
    }

    let finalReceiptName = "";
    let receiptPath = "";

    // Only handle receipt for paid orders, not for trials
    if (!isTrial) {
      if (!receiptFile || typeof receiptFile === "string") {
        return NextResponse.json({ ok: false, error: "Payment slip is required." }, { status: 400 });
      }

      if (fileBuffer) {
        const fileType = receiptFile.type || "image/jpeg";
        const allowedMime = ["image/jpeg", "image/png", "application/pdf"];
        if (!allowedMime.includes(fileType)) {
          return NextResponse.json({ ok: false, error: "Unsupported receipt file type." }, { status: 400 });
        }
        const sanitizedReceiptName = originalReceiptName ? originalReceiptName.replace(/[^a-zA-Z0-9_.-]/g, "_") : "receipt";
        const extension = path.extname(sanitizedReceiptName).toLowerCase()
          || (fileType === "application/pdf" ? ".pdf" : fileType === "image/png" ? ".png" : ".jpg");
        finalReceiptName = `${orderId}${extension}`;
        receiptPath = `/api/admin/orders/${encodeURIComponent(orderId)}/receipt`;
      }
    }

    // Calculate 24-hour activation deadline for tracking
    const activationDeadline = new Date(orderDateValue);
    activationDeadline.setHours(activationDeadline.getHours() + 24);

    // Create stored order object
    let storedOrder: StoredOrder = {
      orderId,
          requestId,
      customerName,
      customerEmail,
      canvaEmail,
      paymentMethod: paymentMethod as "Free Trial" | "Bank Transfer" | "Other",
      paymentStatus: "PENDING",
      selectedPlan: isTrial ? "3 Days Free Trial" : selectedPlan,
      orderCreatedAt: orderDateValue.toISOString(),
      createdAt: orderDateValue.toISOString(),
      updatedAt: orderDateValue.toISOString(),
      // Real creation timestamps (REQUEST_SENT status)
      createdDate: serverDateTime.date,
      createdTime: serverDateTime.time,
      requestReceivedAt: orderDateValue.toISOString(), // Track when request was received
      activationDeadlineAt: activationDeadline.toISOString(), // 24-hour deadline
      status: "PENDING",
      expirationNotificationSent: false,
      expiryAt: requestExpiryDateTime.at,
      expiryDate: requestExpiryDateTime.date,
      expiryTime: requestExpiryDateTime.time,
      planType: requestPlanType === "YEARLY" ? "YEARLY" : requestPlanType || undefined,
      duration: requestPlanType ? getPlanDurationDisplay(requestPlanType) : undefined,
      promotionName: priceState.promotionName,
      promotionId: priceState.promotionId,
      ...getOrderPricingFields(priceState),
    };

    if (isTrial) {
      // Trial-specific fields
      storedOrder.customerPhone = customerPhone;
      storedOrder.trialEndAt = requestExpiryDateTime.at;
      storedOrder.trialEndDate = requestExpiryDateTime.date;
      storedOrder.trialEndTime = requestExpiryDateTime.time;
      // Trials also start with REQUEST_SENT status, not ACTIVE
      // They will only become ACTIVE after admin verification
    } else {
      // Paid order-specific fields
      storedOrder.customerPhone = customerPhone;
      storedOrder.selectedPlan = selectedPlan;
      storedOrder.paymentDetails = paymentDetails;
      storedOrder.additionalInfo = additionalInfo;
      storedOrder.receiptFilename = finalReceiptName;
      storedOrder.receiptPath = receiptPath;
      storedOrder.storageKey = finalReceiptName;
    }

    let persistedSubmission;
    try {
      persistedSubmission = await createOrderIdempotently(storedOrder, idempotencyKey, payloadHash);
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        return NextResponse.json(
          { ok: false, error: "This submission has changed. Please submit it again." },
          { status: 409 },
        );
      }
      if (isTrial && await hasFreeTrial(canvaEmail)) {
        return NextResponse.json(
          {
            ok: false,
            error: "This Canva email address has already been used for a free trial. Each Canva email account can receive the 3-day free trial only once.",
            isDuplicate: true,
          },
          { status: 400 },
        );
      }
      throw error;
    }

    if (!persistedSubmission.created) {
      const action = getIdempotencyAction(persistedSubmission.persisted.telegramDeliveryStatus);
      if (action === "in-progress") {
        return NextResponse.json(
          { ok: false, error: "Your order is still being processed. Please retry shortly." },
          { status: 409 },
        );
      }
      if (action === "manual-reconciliation") {
        return NextResponse.json(
          { ok: false, error: "We could not confirm delivery. Please contact support before retrying." },
          { status: 409 },
        );
      }
      storedOrder = persistedSubmission.persisted.order;
    }

    if (!isTrial && storedOrder.promoCode && storedOrder.promoCodeApplied) {
      await incrementPromoUsage(
        storedOrder.promoCode,
        storedOrder.orderId,
        storedOrder.selectedPlan,
        storedOrder.mainPrice,
        storedOrder.promoDiscountAmount,
        storedOrder.finalPrice,
      );
    }

    const order: StoredOrder = storedOrder;
    if (!isTrial && fileBuffer) {
      const receiptMime = resolveReceiptMime(finalReceiptName, receiptFile && typeof receiptFile !== "string" ? receiptFile.type || "image/jpeg" : "image/jpeg");
      const receiptResult = await saveReceiptFile({
        name: originalReceiptName || finalReceiptName,
        type: receiptMime,
        buffer: fileBuffer,
      }, order.orderId);
      if (!receiptResult.saved) {
        return NextResponse.json({ ok: false, error: receiptResult.reason || "Unable to store payment receipt." }, { status: 500 });
      }
      order.receiptFilename = receiptResult.filename;
      order.receiptPath = receiptResult.path;
      order.storageKey = receiptResult.storageKey;
      receiptPath = receiptResult.path;
    }

    const telegramBotToken = isTrial ? FREE_TRIAL_BOT_TOKEN : TELEGRAM_BOT_TOKEN;
    const telegramChatId = isTrial ? FREE_TRIAL_CHAT_ID : TELEGRAM_CHAT_ID;
    const missingTelegramConfiguration = getMissingTelegramConfiguration(
      isTrial,
      Boolean(telegramBotToken),
      Boolean(telegramChatId),
    );
    if (missingTelegramConfiguration.length > 0 || !telegramBotToken || !telegramChatId) {
      console.error("Telegram order delivery configuration missing:", missingTelegramConfiguration);
      return NextResponse.json(
        { ok: false, error: isTrial ? "Unable to send your Free Trial request right now. Please try again." : "Unable to send the order to Telegram right now. Please try again." },
        { status: 503 }
      );
    }

    // Build the appropriate Telegram message
    // CRITICAL: These functions validate that dates/times are never TBD
    let telegramMessageText: string;
    try {
      if (isTrial) {
        // Use trial request message with real creation date/time
        telegramMessageText = buildTrialRequestMessage(storedOrder);
      } else {
        // New order message for paid orders (before activation)
        telegramMessageText = buildNewOrderMessage(order);
      }
    } catch (error) {
      console.error("ORDER MESSAGE FORMAT ERROR:", error instanceof Error ? error.name : "UnknownError");
      return NextResponse.json(
        { ok: false, error: "Unable to format order message. Please try again." },
        { status: 500 }
      );
    }

    const errorMessage = isTrial
      ? "Unable to send your Free Trial request right now. Please try again."
      : "Unable to send the order to Telegram right now. Please try again.";

    if (persistedSubmission.persisted.telegramDeliveryStatus !== "SENT") {
      const claimed = await claimDelivery(order.orderId, "telegram");
      if (!claimed) {
        const current = await getOrderSnapshot(order.orderId);
        if (current?.telegramDeliveryStatus !== "SENT") {
          return NextResponse.json(
            { ok: false, error: "Your order is already being processed. Please retry shortly." },
            { status: 409 },
          );
        }
      } else {
        const telegramDelivery = await sendTelegramMessage(
          fetch,
          telegramBotToken,
          telegramChatId,
          escapeOrderTelegramMessage(telegramMessageText),
        );
        const telegramOutcome = telegramDelivery.outcome;
        if (telegramOutcome !== "SENT") {
          if (telegramDelivery.httpStatus !== undefined) {
            console.error("Telegram rejected order delivery:", {
              httpStatus: telegramDelivery.httpStatus,
              telegramErrorCode: telegramDelivery.errorCode,
              outcome: telegramOutcome,
            });
          }
          await setDeliveryStatus(order.orderId, "telegram", telegramOutcome);
          return NextResponse.json(
            {
              ok: false,
              error: telegramOutcome === "UNKNOWN"
                ? "Delivery could not be confirmed. Please contact support before retrying."
                : errorMessage,
            },
            { status: 502 },
          );
        }
        await setDeliveryStatus(order.orderId, "telegram", telegramOutcome);
      }
    }

    // For trials: Send NEXT message immediately after successful main message
    if (isTrial && persistedSubmission.persisted.nextDeliveryStatus !== "SENT") {
      try {
        const claimed = await claimDelivery(order.orderId, "next");
        if (claimed) {
          const nextMessageSentAt = new Date();
          const nextResponse = await fetch(`https://api.telegram.org/bot${FREE_TRIAL_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: FREE_TRIAL_CHAT_ID,
              text: escapeOrderTelegramMessage(buildNextMessage()),
              parse_mode: "MarkdownV2",
              disable_web_page_preview: true,
            }),
          });
          const nextPayload = await nextResponse.json().catch(() => null);
          const nextOutcome = classifyTelegramResponse(nextResponse.ok, nextPayload);
          if (nextOutcome === "SENT") {
            await setDeliveryStatus(order.orderId, "next", "SENT");
            await markTrialNextMessageSent(order.orderId, nextMessageSentAt.toISOString());
          } else {
            await setDeliveryStatus(order.orderId, "next", nextOutcome);
            console.error("Failed to send trial NEXT message.");
          }
        }
      } catch (error) {
        await setDeliveryStatus(order.orderId, "next", "UNKNOWN");
        console.error("Error sending trial NEXT message:", error instanceof Error ? error.name : "UnknownError");
      }
    }

    // Only send receipt document for paid orders, not for trials
    if (!isTrial && finalReceiptName && fileBuffer) {
      if (persistedSubmission.persisted.receiptDeliveryStatus !== "SENT") {
        const claimed = await claimDelivery(order.orderId, "receipt");
        if (!claimed) {
          const current = await getOrderSnapshot(order.orderId);
          if (current?.receiptDeliveryStatus !== "SENT") {
            return NextResponse.json(
              { ok: false, error: "Payment receipt delivery is being processed. Please retry shortly." },
              { status: 409 },
            );
          }
        } else {
          const receiptMime = resolveReceiptMime(finalReceiptName, receiptFile && typeof receiptFile !== "string" ? receiptFile.type || "image/jpeg" : "image/jpeg");
          const photoPayload = new FormData();
          const photoBlob = new Blob([Uint8Array.from(fileBuffer)], { type: receiptMime });
          photoPayload.append("chat_id", String(TELEGRAM_CHAT_ID));
          photoPayload.append("caption", `Order Number: ${order.orderId}`);
          photoPayload.append("document", photoBlob, finalReceiptName);
          let documentResponse: Response;
          try {
            documentResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
              method: "POST",
              body: photoPayload,
            });
          } catch {
            await setDeliveryStatus(order.orderId, "receipt", "UNKNOWN");
            return NextResponse.json(
              { ok: false, error: "Receipt delivery could not be confirmed. Please contact support before retrying." },
              { status: 502 },
            );
          }
          const documentPayload = await documentResponse.json().catch(() => null);
          const receiptOutcome = classifyTelegramResponse(documentResponse.ok, documentPayload);
          if (receiptOutcome !== "SENT") {
            await setDeliveryStatus(order.orderId, "receipt", receiptOutcome);
            return NextResponse.json(
              {
                ok: false,
                error: receiptOutcome === "UNKNOWN"
                  ? "Receipt delivery could not be confirmed. Please contact support before retrying."
                  : "Unable to send the payment receipt to Telegram. Please try again.",
              },
              { status: 502 },
            );
          }
          await setDeliveryStatus(order.orderId, "receipt", receiptOutcome);
        }
      }
    }

    // For paid orders: Send NEXT message after successful image delivery (or after main message if no image)
    if (!isTrial && persistedSubmission.persisted.nextDeliveryStatus !== "SENT") {
      try {
        const claimed = await claimDelivery(order.orderId, "next");
        if (claimed) {
          const nextMessageSentAt = new Date();
          const nextResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: escapeOrderTelegramMessage(buildNextMessage()),
              parse_mode: "MarkdownV2",
              disable_web_page_preview: true,
            }),
          });
          const nextPayload = await nextResponse.json().catch(() => null);
          const nextOutcome = classifyTelegramResponse(nextResponse.ok, nextPayload);
          if (nextOutcome === "SENT") {
            await setDeliveryStatus(order.orderId, "next", "SENT");
            await markOrderNextMessageSent(order.orderId, nextMessageSentAt.toISOString());
          } else {
            await setDeliveryStatus(order.orderId, "next", nextOutcome);
            console.error("Failed to send order NEXT message.");
          }
        }
      } catch (error) {
        await setDeliveryStatus(order.orderId, "next", "UNKNOWN");
        console.error("Error sending order NEXT message:", error instanceof Error ? error.name : "UnknownError");
      }
    }

    return buildSuccessResponse(order, isTrial);
  } catch (error) {
    const diagnostic = getSafeOrderSubmissionDiagnostic(error);
    console.error("Order API error:", diagnostic);
    const errorMessage = diagnostic.category === "DATABASE_CONFIGURATION" || diagnostic.category === "DATABASE"
      ? "Order storage is temporarily unavailable. Please try again."
      : diagnostic.category === "FILESYSTEM"
        ? "Unable to store the payment receipt. Please try again."
        : diagnostic.category === "APPLICATION_CONFIGURATION"
          ? "Order pricing settings are unavailable. Please contact support."
        : "Unable to process your order right now. Please try again.";
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
