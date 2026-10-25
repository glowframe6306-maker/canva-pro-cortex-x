/**
 * API endpoint for activating paid Canva Pro orders and free trials
 * Sets activation time, calculates expiry, and sends activation notification
 *
 * POST /api/orders/activate
 * Body: { orderId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrder } from "@/lib/order-database";
import { calculateExpiry, getPlanDurationDisplay, planNameToPlanType, getDateTimeInTimezone } from "@/lib/expiry-calculator";
import { buildPaidOrderActivationMessage, buildTrialActivationMessage, escapeMarkdown } from "@/lib/telegram-messages";
import { hasAdminSession } from "@/lib/admin-auth";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const FREE_TRIAL_BOT_TOKEN = process.env.FREE_TRIAL_BOT_TOKEN;
const FREE_TRIAL_CHAT_ID = process.env.FREE_TRIAL_CHAT_ID;
const APP_TIMEZONE = process.env.TZ || "Asia/Colombo";

export async function POST(request: NextRequest) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { ok: false, error: "Order ID is required." },
        { status: 400 }
      );
    }

    // Get the order from database
    const order = await getOrderById(orderId);

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Order not found." },
        { status: 404 }
      );
    }

    // Check if already activated
    if (order.status === "ACTIVE" || order.activatedAt) {
      return NextResponse.json(
        { ok: false, error: "Order is already activated." },
        { status: 400 }
      );
    }

    // Check if expired
    if (order.status === "EXPIRED") {
      return NextResponse.json(
        { ok: false, error: "Order has expired and cannot be activated." },
        { status: 400 }
      );
    }

    // Get the activation time (now)
    const now = new Date();
    const { date: activationDate, time: activationTime } = getDateTimeInTimezone(now, APP_TIMEZONE);

    // Handle Free Trial activation
    if (order.paymentMethod === "Free Trial") {
      const trialExpiry = calculateExpiry("FREE_TRIAL", now);
      if (!trialExpiry) {
        return NextResponse.json({ ok: false, error: "Failed to calculate trial expiry." }, { status: 500 });
      }
      const trialEndTime = new Date(trialExpiry.expiryAt);

      const { date: trialEndDate, time: trialEndTime_formatted } = getDateTimeInTimezone(trialEndTime, APP_TIMEZONE);
      const reminderTime = new Date(trialEndTime.getTime() - 24 * 60 * 60 * 1000);
      const reminder = getDateTimeInTimezone(reminderTime, APP_TIMEZONE);

      // Update order with trial activation details
      const updatedOrder = await updateOrder(orderId, {
        activatedAt: now.toISOString(),
        expiryAt: trialEndTime.toISOString(),
        planType: "FREE_TRIAL",
        duration: getPlanDurationDisplay("FREE_TRIAL"),
        reminderAt: reminderTime.toISOString(),
        reminderDate: reminder.date,
        reminderTime: reminder.time,
        reminderStatus: "PENDING",
        expiryNotificationStatus: "PENDING",
        trialStartDate: activationDate,
        trialStartTime: activationTime,
        trialStartAt: now.toISOString(),
        trialEndDate,
        trialEndTime: trialEndTime_formatted,
        trialEndAt: trialEndTime.toISOString(),
        status: "ACTIVE",
      });

      if (!updatedOrder) {
        return NextResponse.json(
          { ok: false, error: "Failed to update order." },
          { status: 500 }
        );
      }

      // Send trial activation notification to Telegram
      if (FREE_TRIAL_BOT_TOKEN && FREE_TRIAL_CHAT_ID) {
        try {
          const activationMessage = buildTrialActivationMessage(updatedOrder);
          const telegramResponse = await fetch(`https://api.telegram.org/bot${FREE_TRIAL_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
                chat_id: FREE_TRIAL_CHAT_ID,
              text: escapeMarkdown(activationMessage),
              parse_mode: "MarkdownV2",
              disable_web_page_preview: true,
            }),
          });

          const telegramPayload = await telegramResponse.json().catch(() => ({}));

          if (!telegramResponse.ok || !telegramPayload.ok) {
            console.warn("Failed to send trial activation message to Telegram:", telegramPayload);
            // Don't fail the activation if Telegram notification fails
          }
        } catch (error) {
          console.error("Error sending Telegram trial activation message:", error);
          // Don't fail the activation if Telegram notification fails
        }
      }

      return NextResponse.json({
        ok: true,
        orderId: updatedOrder.orderId,
        message: "Free trial activated successfully.",
        trialStartDate: updatedOrder.trialStartDate,
        trialStartTime: updatedOrder.trialStartTime,
        trialEndDate: updatedOrder.trialEndDate,
        trialEndTime: updatedOrder.trialEndTime,
      });
    }

    // Handle Paid Order activation
    // Calculate expiry based on plan
    const planType = planNameToPlanType(order.selectedPlan);
    if (!planType) {
      return NextResponse.json(
        { ok: false, error: "Invalid plan type." },
        { status: 400 }
      );
    }

    const expiryCalc = calculateExpiry(planType, now);
    if (!expiryCalc) {
      return NextResponse.json(
        { ok: false, error: "Failed to calculate expiry." },
        { status: 500 }
      );
    }
    const reminderTime = expiryCalc.expiryAt ? new Date(new Date(expiryCalc.expiryAt).getTime() - 24 * 60 * 60 * 1000) : null;
    const reminder = reminderTime ? getDateTimeInTimezone(reminderTime, APP_TIMEZONE) : null;

    // Update order with activation and expiry info
    const updatedOrder = await updateOrder(orderId, {
      activatedAt: now.toISOString(),
      activationDate,
      activationTime,
      expiryAt: expiryCalc.expiryAt || undefined,
      expiryDate: expiryCalc.expiryDate,
      expiryTime: expiryCalc.expiryTime,
      durationDays: expiryCalc.durationDays,
      planType: planType === "YEARLY" ? "YEARLY" : planType,
      duration: getPlanDurationDisplay(planType),
      reminderAt: reminderTime?.toISOString(),
      reminderDate: reminder?.date,
      reminderTime: reminder?.time,
      reminderStatus: reminderTime ? "PENDING" : undefined,
      expiryNotificationStatus: "PENDING",
      status: "ACTIVE",
    });

    if (!updatedOrder) {
      return NextResponse.json(
        { ok: false, error: "Failed to update order." },
        { status: 500 }
      );
    }

    // Send activation notification to Telegram
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        const activationMessage = buildPaidOrderActivationMessage(updatedOrder);

        const telegramResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: escapeMarkdown(activationMessage),
            parse_mode: "MarkdownV2",
            disable_web_page_preview: true,
          }),
        });

        const telegramPayload = await telegramResponse.json().catch(() => ({}));

        if (!telegramResponse.ok || !telegramPayload.ok) {
          console.warn("Failed to send activation message to Telegram:", telegramPayload);
          // Don't fail the activation if Telegram notification fails
        }
      } catch (error) {
        console.error("Error sending Telegram activation message:", error);
        // Don't fail the activation if Telegram notification fails
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: updatedOrder.orderId,
      message: "Order activated successfully.",
      activationDate: updatedOrder.activationDate,
      activationTime: updatedOrder.activationTime,
      expiryDate: updatedOrder.expiryDate,
      expiryTime: updatedOrder.expiryTime,
      durationDays: updatedOrder.durationDays,
    });
  } catch (error) {
    console.error("Activation API error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to activate order. Please try again." },
      { status: 500 }
    );
  }
}
