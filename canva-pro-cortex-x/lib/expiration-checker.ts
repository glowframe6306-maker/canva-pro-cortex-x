/**
 * Automatic expiration checker for Canva Pro orders
 * Checks for expired orders and sends expiration notifications
 * Should be run periodically via cron job or scheduled function
 */

import { appendSubscriptionNotificationLog, getOrdersReadyForExpiration, getOrdersReadyForReminder, markExpirationFailed, markExpirationNotificationSent, markReminderFailed, markReminderSent, markReminderNextMessageSent, markExpiryNextMessageSent } from "@/lib/order-database";
import { buildPaidOrderExpirationMessage, buildSubscriptionReminderMessage, buildTrialExpirationMessage, buildNextMessage, escapeMarkdown } from "@/lib/telegram-messages";

const REMINDER_BOT_TOKEN = process.env.REMINDER_BOT_TOKEN;
const REMINDER_CHAT_ID = process.env.REMINDER_CHAT_ID;
const expirationNotificationsInFlight = new Set<string>();

export interface ExpirationCheckResult {
  success: boolean;
  ordersProcessed: number;
  ordersExpired: number;
  errors: string[];
  message: string;
}

/**
 * Check for expired orders and send expiration notifications
 * Should be called periodically (e.g., every 5-15 minutes)
 */
export async function checkAndNotifyExpiredOrders(): Promise<ExpirationCheckResult> {
  const result: ExpirationCheckResult = {
    success: true,
    ordersProcessed: 0,
    ordersExpired: 0,
    errors: [],
    message: "",
  };

  try {
    if (!REMINDER_BOT_TOKEN || !REMINDER_CHAT_ID) {
      result.errors.push("Reminder Telegram configuration missing.");
      result.success = false;
      result.message = "Reminder Telegram not configured";
      return result;
    }

    const reminderOrders = await getOrdersReadyForReminder();
    for (const order of reminderOrders) {
      if (expirationNotificationsInFlight.has(`reminder:${order.orderId}`)) continue;
      expirationNotificationsInFlight.add(`reminder:${order.orderId}`);
      try {
        const sentAt = new Date();
        const message = buildSubscriptionReminderMessage(order, sentAt);
        const response = await fetch(`https://api.telegram.org/bot${REMINDER_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: REMINDER_CHAT_ID, text: escapeMarkdown(message), parse_mode: "MarkdownV2", disable_web_page_preview: true }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(`Telegram API error: ${payload.description || "Unknown error"}`);
        await markReminderSent(order.orderId, sentAt.toISOString());
        await appendSubscriptionNotificationLog({ requestId: order.requestId || order.orderId, plan: order.selectedPlan, notificationType: "SUBSCRIPTION_REMINDER_SENT", scheduledTime: order.reminderAt, attemptTime: sentAt.toISOString(), status: "SENT" });

        // Send NEXT message after successful reminder
        try {
          const nextMessageSentAt = new Date();
          const nextMessage = buildNextMessage();
          const nextResponse = await fetch(`https://api.telegram.org/bot${REMINDER_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: REMINDER_CHAT_ID, text: escapeMarkdown(nextMessage), parse_mode: "MarkdownV2", disable_web_page_preview: true }),
          });
          const nextPayload = await nextResponse.json().catch(() => ({}));
          if (nextResponse.ok && nextPayload.ok) {
            await markReminderNextMessageSent(order.orderId, nextMessageSentAt.toISOString());
          } else {
            console.error("Failed to send reminder NEXT message:", nextPayload);
          }
        } catch (nextError) {
          console.error("Error sending reminder NEXT message:", nextError);
        }
      } catch (error) {
        await markReminderFailed(order.orderId);
        await appendSubscriptionNotificationLog({ requestId: order.requestId || order.orderId, plan: order.selectedPlan, notificationType: "SUBSCRIPTION_REMINDER_FAILED", scheduledTime: order.reminderAt, attemptTime: new Date().toISOString(), status: "FAILED", error: error instanceof Error ? error.message : String(error) });
        console.error(`[Expiration Checker] Reminder failed for ${order.orderId}:`, error instanceof Error ? error.message : String(error));
      } finally {
        expirationNotificationsInFlight.delete(`reminder:${order.orderId}`);
      }
    }

    // Get all orders that are ready for expiration notification
    const expiredOrders = await getOrdersReadyForExpiration();

    result.ordersProcessed = expiredOrders.length;

    if (expiredOrders.length === 0) {
      result.message = "No expired orders to process";
      return result;
    }

    // Process each expired order
    for (const order of expiredOrders) {
      if (expirationNotificationsInFlight.has(order.orderId)) {
        continue;
      }

      expirationNotificationsInFlight.add(order.orderId);
      try {
        // Build the validated message before sending anything to Telegram.
        const expirationSentAt = new Date();
        const expirationMessage = order.paymentMethod === "Free Trial"
          ? buildTrialExpirationMessage(order, expirationSentAt)
          : buildPaidOrderExpirationMessage(order, expirationSentAt);

        // Send Telegram notification
        const telegramResponse = await fetch(`https://api.telegram.org/bot${REMINDER_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: REMINDER_CHAT_ID,
            text: escapeMarkdown(expirationMessage),
            parse_mode: "MarkdownV2",
            disable_web_page_preview: true,
          }),
        });

        const telegramPayload = await telegramResponse.json().catch(() => ({}));

        if (!telegramResponse.ok || !telegramPayload.ok) {
          throw new Error(
            `Telegram API error: ${telegramPayload.description || "Unknown error"}`
          );
        }

        // Mark order as having received expiration notification
        await markExpirationNotificationSent(order.orderId);
        await appendSubscriptionNotificationLog({ requestId: order.requestId || order.orderId, plan: order.selectedPlan, notificationType: "SUBSCRIPTION_EXPIRY_NOTIFICATION_SENT", scheduledTime: order.expiryAt, attemptTime: expirationSentAt.toISOString(), status: "SENT" });

        // Send NEXT message after successful expiry notification
        try {
          const nextMessageSentAt = new Date();
          const nextMessage = buildNextMessage();
          const nextResponse = await fetch(`https://api.telegram.org/bot${REMINDER_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: REMINDER_CHAT_ID, text: escapeMarkdown(nextMessage), parse_mode: "MarkdownV2", disable_web_page_preview: true }),
          });
          const nextPayload = await nextResponse.json().catch(() => ({}));
          if (nextResponse.ok && nextPayload.ok) {
            await markExpiryNextMessageSent(order.orderId, nextMessageSentAt.toISOString());
          } else {
            console.error("Failed to send expiry NEXT message:", nextPayload);
          }
        } catch (nextError) {
          console.error("Error sending expiry NEXT message:", nextError);
        }

        result.ordersExpired++;

        console.log(`[Expiration Checker] Sent expiration notification for order ${order.orderId}`);
      } catch (error) {
        await markExpirationFailed(order.orderId);
        await appendSubscriptionNotificationLog({ requestId: order.requestId || order.orderId, plan: order.selectedPlan, notificationType: "SUBSCRIPTION_EXPIRY_NOTIFICATION_FAILED", scheduledTime: order.expiryAt, attemptTime: new Date().toISOString(), status: "FAILED", error: error instanceof Error ? error.message : String(error) });
        const errorMessage = `Failed to process expiration for order ${order.orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        result.errors.push(errorMessage);
        console.error(`[Expiration Checker] ${errorMessage}`);
      } finally {
        expirationNotificationsInFlight.delete(order.orderId);
      }
    }

    result.message = `Processed ${result.ordersExpired} expired orders`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    result.success = false;
    result.message = "Expiration check failed";
    console.error("[Expiration Checker] Error:", error);
  }

  return result;
}

/**
 * Schedule expiration checking for a Next.js app
 * This creates a persistent interval that checks for expired orders
 * Call this during app initialization (e.g., in layout or middleware)
 */
let expirationCheckInterval: NodeJS.Timeout | null = null;

export function startExpirationChecker(intervalMinutes: number = 5): void {
  if (expirationCheckInterval !== null) {
    console.log("[Expiration Checker] Already running");
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;

  // Run immediately on start
  checkAndNotifyExpiredOrders()
    .then((result) => {
      console.log(`[Expiration Checker] Initial check: ${result.message}`);
    })
    .catch((error) => {
      console.error("[Expiration Checker] Initial check error:", error);
    });

  // Then run periodically
  expirationCheckInterval = setInterval(() => {
    checkAndNotifyExpiredOrders()
      .then((result) => {
        if (!result.success || result.errors.length > 0) {
          console.error(
            `[Expiration Checker] ${result.message} - Errors: ${result.errors.join("; ")}`
          );
        } else if (result.ordersExpired > 0) {
          console.log(
            `[Expiration Checker] ${result.message} (${result.ordersProcessed} orders checked)`
          );
        }
      })
      .catch((error) => {
        console.error("[Expiration Checker] Check error:", error);
      });
  }, intervalMs);

  console.log(`[Expiration Checker] Started - checking every ${intervalMinutes} minutes`);
}

export function stopExpirationChecker(): void {
  if (expirationCheckInterval !== null) {
    clearInterval(expirationCheckInterval);
    expirationCheckInterval = null;
    console.log("[Expiration Checker] Stopped");
  }
}
