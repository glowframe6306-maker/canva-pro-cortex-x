import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { generateFreeTrialRequestId, generateOrderNumber, resolveReceiptMime, saveReceiptFile } from "@/lib/order-system";
import { getDateTimeInTimezone, calculateExpiry, getPlanDurationDisplay, planNameToPlanType } from "@/lib/expiry-calculator";
import { saveOrder, updateOrder, hasFreeTrial, markOrderNextMessageSent, markTrialNextMessageSent } from "@/lib/order-database";
import { buildNewOrderMessage, buildTrialRequestMessage, buildNextMessage, escapeMarkdown } from "@/lib/telegram-messages";
import type { StoredOrder } from "@/lib/order-database";
import { getMainPlanPrice, getPromotionPriceForPlan, resolvePlanPricing } from "@/lib/pricing";
import { getActivePromotion } from "@/lib/promotion-database";
import { getSiteSettings, validatePromoCodeForPlan } from "@/lib/site-settings";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const FREE_TRIAL_BOT_TOKEN = process.env.FREE_TRIAL_BOT_TOKEN;
const FREE_TRIAL_CHAT_ID = process.env.FREE_TRIAL_CHAT_ID;
const APP_TIMEZONE = process.env.TZ || "Asia/Colombo";

function formatLocalDate(date: Date) {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(date);
  return formatted;
}

function formatLocalTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: APP_TIMEZONE,
  }).format(date);
}

function getLocalDateTimeStrings(date = new Date()) {
  return {
    date: formatLocalDate(date),
    time: formatLocalTime(date),
  };
}


function normalizePhone(phone: string) {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.startsWith("00") ? `+${cleaned.slice(2)}` : cleaned;
}

function buildWhatsAppUrl(order: Record<string, unknown>) {
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
    `Payment Receipt: ${order.receiptFilename || order.receiptName || "N/A"}`,
  ].join("\n");

  const encodedText = encodeURIComponent(text);
  const whatsappNumber = "94756390621";
  return `https://wa.me/${whatsappNumber}?text=${encodedText}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries());

    const paymentMethod = String(body.paymentMethod || "").trim();
    const isTrial = paymentMethod === "Free Trial";

    // Different validation for free trials vs paid orders
    if (isTrial) {
      const requiredTrial = ["customerName", "customerEmail", "customerPhone", "canvaEmail"];
      const missingTrial = requiredTrial.filter((field) => !String(body?.[field] ?? "").trim());
      if (missingTrial.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Please fill in all required fields." },
          { status: 400 }
        );
      }
    } else {
      // Paid order validation
      const required = [
        "customerName",
        "customerPhone",
        "customerEmail",
        "selectedPlan",
        "planPrice",
        "paymentMethod",
        "paymentDetails",
        "orderDate",
      ];
      const missing = required.filter((field) => !String(body?.[field] ?? "").trim());
      if (missing.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Missing required order information." },
          { status: 400 }
        );
      }
    }

    const customerName = String(body.customerName || "").trim();
    const customerEmail = String(body.customerEmail || "").trim();
    const canvaEmail = String(body.canvaEmail || "").trim().toLowerCase();
    const customerPhone = String(body.customerPhone || "").trim();
    const selectedPlan = String(body.selectedPlan || "").trim();
    const planPrice = String(body.planPrice || "").trim();
    const paymentDetails = String(body.paymentDetails || "").trim();
    const selectedPlanKey = String(selectedPlan || "").trim().toLowerCase();
    const enteredPromoCode = String(body.promoCode || body.promo || "").trim();
    const priceState = await resolvePlanPricing(selectedPlanKey, enteredPromoCode || undefined);
    const verifiedPlanPrice = Number(priceState.finalPrice || 0) || 0;
    const mainPrice = getMainPlanPrice(selectedPlanKey) || Number(planPrice || 0) || 0;
    const activePromotion = await getActivePromotion();
    const promotionOffer = activePromotion ? getPromotionPriceForPlan(selectedPlanKey, activePromotion) : null;
    const promoValidation = enteredPromoCode ? await validatePromoCodeForPlan(enteredPromoCode, selectedPlanKey, mainPrice) : null;
    const discountSource = String(priceState.priceSource || "main");
    const siteSettings = await getSiteSettings();
    const promotionDiscountAmount = promotionOffer && promotionOffer.hasActivePromotion ? Math.max(0, mainPrice - promotionOffer.promotionPrice) : 0;
    const promotionDiscountPercentage = promotionOffer && promotionOffer.hasActivePromotion && mainPrice > 0 ? Math.round((promotionDiscountAmount / mainPrice) * 100) : 0;
    const promoDiscountAmount = promoValidation?.valid ? Number(promoValidation.discount || 0) : 0;
    const promoDiscountPercentage = promoValidation?.valid && mainPrice > 0 ? Math.round((promoDiscountAmount / mainPrice) * 100) : 0;
    const orderDateValue = new Date();
    const serverDateTime = getLocalDateTimeStrings(orderDateValue);
    const orderDate = String(body.orderDate || orderDateValue.toISOString()).trim();
    const additionalInfo = String(body.additionalInfo || "").trim();
    const originalReceiptName = String(body.receiptName || "").trim();
    const receiptFile = formData.get("receipt");

    // Check for free trial duplicates (server-side, before any other processing)
    if (isTrial) {
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

    // Validate required fields based on order type
    if (!isTrial && (!customerName || !customerPhone || !customerEmail || !selectedPlan || !paymentMethod || !paymentDetails)) {
      return NextResponse.json({ ok: false, error: "Invalid order details provided." }, { status: 400 });
    }

    if (isTrial && (!customerName || !customerEmail || !customerPhone || !canvaEmail)) {
      return NextResponse.json({ ok: false, error: "Invalid free trial details." }, { status: 400 });
    }

    const orderId = await generateOrderNumber();
      const requestId = isTrial ? await generateFreeTrialRequestId() : undefined;
    const requestPlanType = isTrial ? planNameToPlanType("FREE_TRIAL") : planNameToPlanType(selectedPlan);
    const paidRequestExpiry = requestPlanType ? calculateExpiry(requestPlanType, orderDateValue) : null;
    const trialRequestExpiry = isTrial ? new Date(orderDateValue) : null;
    if (trialRequestExpiry) {
      trialRequestExpiry.setDate(trialRequestExpiry.getDate() + 3);
    }
    const requestExpiryDateTime = paidRequestExpiry
      ? { date: paidRequestExpiry.expiryDate, time: paidRequestExpiry.expiryTime, at: paidRequestExpiry.expiryAt }
      : trialRequestExpiry
        ? { ...getLocalDateTimeStrings(trialRequestExpiry), at: trialRequestExpiry.toISOString() }
        : null;

    if (!requestExpiryDateTime) {
      return NextResponse.json({ ok: false, error: "Unable to calculate order expiry." }, { status: 500 });
    }

    let fileBuffer: Buffer | null = null;
    let finalReceiptName = "";
    let receiptPath = "";

    // Only handle receipt for paid orders, not for trials
    if (!isTrial) {
      if (!receiptFile || typeof receiptFile === "string") {
        return NextResponse.json({ ok: false, error: "Payment slip is required." }, { status: 400 });
      }

      fileBuffer = receiptFile && typeof receiptFile !== "string" ? Buffer.from(await receiptFile.arrayBuffer()) : null;

      const sanitizedReceiptName = originalReceiptName ? originalReceiptName.replace(/[^a-zA-Z0-9_.-]/g, "_") : "receipt";
      finalReceiptName = `${orderId}${path.extname(sanitizedReceiptName || "receipt") || ".jpg"}`;

      if (fileBuffer) {
        const fileType = receiptFile.type || "image/jpeg";
        const allowedMime = ["image/jpeg", "image/png", "application/pdf"];
        if (!allowedMime.includes(fileType)) {
          return NextResponse.json({ ok: false, error: "Unsupported receipt file type." }, { status: 400 });
        }

        const storageResult = await saveReceiptFile({
          name: sanitizedReceiptName,
          type: resolveReceiptMime(sanitizedReceiptName, fileType),
          buffer: fileBuffer,
        }, orderId);

        if (!storageResult.saved) {
          return NextResponse.json({ ok: false, error: storageResult.reason || "Unable to store receipt upload." }, { status: 400 });
        }

        finalReceiptName = storageResult.filename;
        receiptPath = storageResult.path;
      }
    }

    // Calculate 24-hour activation deadline for tracking
    const activationDeadline = new Date(orderDateValue);
    activationDeadline.setHours(activationDeadline.getHours() + 24);

    // Create stored order object
    const discountType =
      discountSource === "promotion" ? "PROMOTION" :
      discountSource === "promo-code" ? "PROMO_CODE" :
      discountSource === "stacked" ? "PROMOTION + PROMO_CODE" :
      "NONE";

    const storedOrder: StoredOrder = {
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
      mainPrice: mainPrice || Number(planPrice || 0) || 0,
      promotionName: activePromotion?.name || undefined,
      promotionId: activePromotion?.id || undefined,
      promotionPrice: promotionOffer && promotionOffer.hasActivePromotion ? promotionOffer.promotionPrice : undefined,
      promotionDiscountPercentage: promotionDiscountPercentage || undefined,
      promotionDiscountAmount: promotionDiscountAmount || undefined,
      promoCode: enteredPromoCode && promoValidation?.valid ? enteredPromoCode.toUpperCase() : undefined,
      discountType,
      discountPercentage: discountType === "NONE" ? 0 : (discountType === "PROMOTION" ? promotionDiscountPercentage : discountType === "PROMO_CODE" ? promoDiscountPercentage : Math.max(promotionDiscountPercentage, promoDiscountPercentage)),
      discountAmount: discountType === "NONE" ? 0 : (discountType === "PROMOTION" ? promotionDiscountAmount : discountType === "PROMO_CODE" ? promoDiscountAmount : Math.max(promotionDiscountAmount, promoDiscountAmount)),
      finalPrice: verifiedPlanPrice,
      planPrice: String(verifiedPlanPrice),
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
      storedOrder.planPrice = String(verifiedPlanPrice);
      storedOrder.paymentDetails = paymentDetails;
      storedOrder.additionalInfo = additionalInfo;
      storedOrder.receiptFilename = finalReceiptName;
      storedOrder.receiptPath = receiptPath;
      storedOrder.storageKey = finalReceiptName;      storedOrder.mainPrice = mainPrice || Number(planPrice || 0) || 0;
      storedOrder.finalPrice = verifiedPlanPrice;
      storedOrder.planPrice = String(verifiedPlanPrice);    }

    // For backward compatibility with frontend
    const order: Record<string, any> = {
      orderId,
      customerName,
      customerEmail,
      canvaEmail,
      paymentMethod,
      orderDate: serverDateTime.date,
      orderTime: serverDateTime.time,
      orderCreatedAt: orderDateValue.toISOString(),
      expiryDate: requestExpiryDateTime.date,
      expiryTime: requestExpiryDateTime.time,
    };

    if (!isTrial) {
      order.customerPhone = customerPhone;
      order.selectedPlan = selectedPlan;
      order.planPrice = String(verifiedPlanPrice);
      order.paymentDetails = paymentDetails;
      order.additionalInfo = additionalInfo;
      order.receiptName = finalReceiptName;
      order.receiptFilename = finalReceiptName;
      order.storageKey = finalReceiptName;
      order.receiptPath = receiptPath;
    }

    if (isTrial) {
      order.trialEndAt = requestExpiryDateTime.at;
      order.trialEndDate = requestExpiryDateTime.date;
      order.trialEndTime = requestExpiryDateTime.time;
    }

    const telegramBotToken = isTrial ? FREE_TRIAL_BOT_TOKEN : TELEGRAM_BOT_TOKEN;
    const telegramChatId = isTrial ? FREE_TRIAL_CHAT_ID : TELEGRAM_CHAT_ID;
    if (!telegramBotToken || !telegramChatId) {
      return NextResponse.json(
        { ok: false, error: isTrial ? "Unable to send your Free Trial request right now. Please try again." : "Unable to send the order to Telegram right now. Please try again." },
        { status: 500 }
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
        telegramMessageText = buildNewOrderMessage(storedOrder);
      }
    } catch (error) {
      console.error("ORDER MESSAGE FORMAT ERROR:", error instanceof Error ? error.message : String(error));
      return NextResponse.json(
        { ok: false, error: "Unable to format order message. Please try again." },
        { status: 500 }
      );
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: escapeMarkdown(telegramMessageText),
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });

    const telegramPayload = await telegramResponse.json().catch(() => ({}));

    if (!telegramResponse.ok || !telegramPayload.ok) {
      return NextResponse.json(
        { ok: false, error: isTrial ? "Unable to send your Free Trial request right now. Please try again." : "Unable to send the order to Telegram right now. Please try again." },
        { status: 502 }
      );
    }

    // Persist the exact order used to build the notification.
    await saveOrder(storedOrder);

    // For trials: Send NEXT message immediately after successful main message
    if (isTrial) {
      try {
        const nextMessageSentAt = new Date();
        const nextMessage = buildNextMessage();
        const nextResponse = await fetch(`https://api.telegram.org/bot${FREE_TRIAL_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: FREE_TRIAL_CHAT_ID,
            text: escapeMarkdown(nextMessage),
            parse_mode: "MarkdownV2",
            disable_web_page_preview: true,
          }),
        });
        const nextPayload = await nextResponse.json().catch(() => ({}));
        if (nextResponse.ok && nextPayload.ok) {
          await markTrialNextMessageSent(orderId, nextMessageSentAt.toISOString());
        } else {
          console.error("Failed to send trial NEXT message:", nextPayload);
        }
      } catch (error) {
        console.error("Error sending trial NEXT message:", error);
      }
    }

    // Only send receipt document for paid orders, not for trials
    let imageDeliverySuccessful = true;
    if (!isTrial && receiptFile && typeof receiptFile !== "string" && finalReceiptName) {
      const receiptMime = resolveReceiptMime(finalReceiptName, receiptFile.type || "image/jpeg");
      if (receiptMime === "application/pdf" || receiptMime.startsWith("image/")) {
        const photoPayload = new FormData();
        const receiptUrl = receiptPath;
        const fileContent = await fs.readFile(receiptUrl);
        const photoBlob = new Blob([fileContent], { type: receiptMime });
        photoPayload.append("chat_id", String(TELEGRAM_CHAT_ID));
        photoPayload.append("caption", `Order Number: ${orderId}`);
        photoPayload.append("document", photoBlob, finalReceiptName);
        const documentResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
          method: "POST",
          body: photoPayload,
        });
        const documentPayload = await documentResponse.json().catch(() => ({}));
        if (!documentResponse.ok || !documentPayload.ok) {
          console.error("Failed to send payment slip to Telegram:", documentPayload);
          imageDeliverySuccessful = false;
        }
      }
    }

    // For paid orders: Send NEXT message after successful image delivery (or after main message if no image)
    if (!isTrial && imageDeliverySuccessful) {
      try {
        const nextMessageSentAt = new Date();
        const nextMessage = buildNextMessage();
        const nextResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: escapeMarkdown(nextMessage),
            parse_mode: "MarkdownV2",
            disable_web_page_preview: true,
          }),
        });
        const nextPayload = await nextResponse.json().catch(() => ({}));
        if (nextResponse.ok && nextPayload.ok) {
          await markOrderNextMessageSent(orderId, nextMessageSentAt.toISOString());
        } else {
          console.error("Failed to send order NEXT message:", nextPayload);
        }
      } catch (error) {
        console.error("Error sending order NEXT message:", error);
      }
    }

    const whatsappUrl = !isTrial ? buildWhatsAppUrl(order) : "";

    const response: Record<string, any> = {
      ok: true,
      orderId: order.orderId,
      orderNumber: order.orderId,
      requestId: order.requestId,
      referenceNumber: order.paymentDetails || paymentDetails || "",
      isTrial: isTrial,
      message: isTrial ? "Free trial request submitted successfully." : "Order submitted successfully.",
    };

    if (!isTrial) {
      response.receiptFilename = order.receiptFilename;
      response.receiptPath = order.receiptPath;
      response.storageKey = order.storageKey;
      response.whatsappUrl = whatsappUrl;
    }

    if (isTrial) {
      response.trialEndDate = order.trialEndDate;
      response.trialEndTime = order.trialEndTime;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Order API error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to send the order to Telegram right now. Please try again." },
      { status: 500 }
    );
  }
}
