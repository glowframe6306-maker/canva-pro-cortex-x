/**
 * Telegram message formatting for Canva Pro orders
 * Handles both activation and expiration messages
 * All messages must have real dates and times - never TBD
 */

import type { StoredOrder } from "@/lib/order-database";
import { getPlanDurationDisplay } from "@/lib/expiry-calculator";
import { getDateTimeInTimezone } from "@/lib/expiry-calculator";

/**
 * Validates that date and time values are present and not TBD
 * Used before sending any Telegram message
 */
export function validateDateTimeFields(date?: string, time?: string): boolean {
  return Boolean(
    date &&
      time &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      /^\d{2}:\d{2}:\d{2}$/.test(time) &&
      !Number.isNaN(new Date(`${date}T${time}+05:30`).getTime())
  );
}

function requiredValue(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized === "TBD" || normalized === "YYYY-MM-DD" || normalized === "HH:MM:SS") {
    throw new Error(`Cannot send Telegram message: Missing ${label}`);
  }
  return normalized;
}

function requiredDateTime(order: StoredOrder, date: unknown, time: unknown, label: string): { date: string; time: string } {
  const dateValue = requiredValue(date, `${label} date`);
  const timeValue = requiredValue(time, `${label} time`);
  if (!validateDateTimeFields(dateValue, timeValue)) {
    throw new Error(`Cannot send Telegram message: Invalid ${label} date/time`);
  }
  return { date: dateValue, time: timeValue };
}

function requiredExpiry(order: StoredOrder): { date: string; time: string } {
  if (order.expiryDate === "NEVER" && order.expiryTime === "NEVER") {
    return { date: "NEVER", time: "NEVER" };
  }
  return requiredDateTime(order, order.expiryDate, order.expiryTime, "expiry");
}

function subscriptionPlan(order: StoredOrder) {
  const planType = requiredValue(order.planType, "plan type");
  const duration = requiredValue(order.duration || getPlanDurationDisplay(planType), "duration");
  return { planType, duration };
}

function formatCurrency(amount: number | string | undefined) {
  const safeValue = Number(amount || 0);
  return `LKR ${safeValue.toLocaleString("en-LK")}`;
}

function appendPricingDetails(lines: string[], order: StoredOrder) {
  const mainPrice = Number(order.mainPrice || order.planPrice || 0) || 0;
  const finalPrice = Number(order.finalPrice || order.planPrice || mainPrice || 0) || 0;
  const discountAmount = Number(order.discountAmount || 0) || 0;
  const discountPercentage = Number(order.discountPercentage || 0) || 0;

  lines.push("", "━━━━━━━━━━━━━━━━━━", "💰 PRICING", "━━━━━━━━━━━━━━━━━━", "");
  lines.push(`Main Price: ${formatCurrency(mainPrice)}`);

  if (order.discountType === "PROMOTION" || order.discountType === "PROMOTION + PROMO_CODE") {
    const promotionName = order.promotionName || "Promotion";
    const promotionPrice = Number(order.promotionPrice || finalPrice || mainPrice || 0);
    lines.push(`Promotion: ${promotionName}`);
    lines.push(`Promotion Price: ${formatCurrency(promotionPrice)}`);
    lines.push(`Discount: ${discountPercentage > 0 ? `${discountPercentage}% OFF` : "0% OFF"}`);
    lines.push(`You Saved: ${formatCurrency(discountAmount)}`);
  }

  if (order.discountType === "PROMO_CODE" || order.discountType === "PROMOTION + PROMO_CODE") {
    const promoCode = order.promoCode || "PROMO";
    lines.push(`Promo Code: ${promoCode}`);
    lines.push(`Promo Discount: ${discountPercentage > 0 ? `${discountPercentage}% OFF` : "0% OFF"}`);
    lines.push(`Discount Amount: ${formatCurrency(discountAmount)}`);
  }

  if (order.discountType === "NONE") {
    lines.push("Discount: LKR 0");
  }

  lines.push(`Final Price: ${formatCurrency(finalPrice)}`);
}

export function buildSubscriptionReminderMessage(order: StoredOrder, sentAt: Date): string {
  const plan = subscriptionPlan(order);
  const expiry = requiredDateTime(order, order.expiryDate, order.expiryTime, "expiry");
  const start = requiredDateTime(order, order.activationDate || order.trialStartDate, order.activationTime || order.trialStartTime, "start");
  const reminder = requiredDateTime(order, order.reminderDate, order.reminderTime, "reminder");
  const sent = getDateTimeInTimezone(sentAt, "Asia/Colombo");
  const id = requiredValue(order.requestId || order.orderId, "request/order ID");
  const titlePlan = plan.planType === "FREE_TRIAL" ? "FREE TRIAL" : plan.planType;
  return [
    `⏳ ${titlePlan} EXPIRES IN 1 DAY`, "", "━━━━━━━━━━━━━━━━━━━━", "",
    "🆔 REQUEST / ORDER ID", id, "", "👤 CUSTOMER DETAILS", "",
    `Name: ${requiredValue(order.customerName, "full name")}`,
    `📧 Email: ${requiredValue(order.customerEmail, "email")}`,
    `📱 WhatsApp: ${requiredValue(order.customerPhone, "WhatsApp number")}`,
    `🎨 Canva Email: ${requiredValue(order.canvaEmail, "Canva email")}`,
    "", "━━━━━━━━━━━━━━━━━━━━", "", "📦 SUBSCRIPTION DETAILS", "",
    `Plan: ${titlePlan}`, `Plan Type: ${plan.planType}`, `⏱️ Duration: ${plan.duration}`,
    "", "━━━━━━━━━━━━━━━━━━━━", "", "📅 START INFORMATION", "",
    `Started On: ${start.date}`, `Started At: ${start.time}`,
    "", "━━━━━━━━━━━━━━━━━━━━", "", "📅 EXPIRY INFORMATION", "",
    `Expires On: ${expiry.date}`, `Expires At: ${expiry.time}`,
    "⏳ Remaining: 1 DAY / 24 HOURS", `📌 Reminder Scheduled For: ${reminder.date} ${reminder.time}`,
    `📌 Reminder Sent At: ${sent.date} ${sent.time}`, "", "━━━━━━━━━━━━━━━━━━━━", "",
    "📦 Notification Type: SUBSCRIPTION_EXPIRING_IN_1_DAY", "📌 Current Status: ACTIVE", "",
    "⚠️ This subscription will expire exactly 24 hours from the scheduled expiry time.",
  ].join("\n");
}

/**
 * Build the new order message for a paid order request (REQUEST_SENT status)
 * Sent immediately after order submission with creation date/time
 */
export function buildNewOrderMessage(order: StoredOrder): string {
  const created = requiredDateTime(order, order.createdDate, order.createdTime, "request");
  const expiry = requiredExpiry(order);
  const orderId = requiredValue(order.orderId, "order number");
  const plan = requiredValue(order.selectedPlan, "plan");
  const duration = getPlanDurationDisplay(plan);
  const customerName = requiredValue(order.customerName, "full name");
  const customerEmail = requiredValue(order.customerEmail, "email address");
  const customerPhone = requiredValue(order.customerPhone, "WhatsApp number");
  const canvaEmail = requiredValue(order.canvaEmail, "Canva email");
  const paymentDetails = requiredValue(order.paymentDetails, "reference number");
  const receiptFilename = requiredValue(order.receiptFilename, "payment slip filename");
  if (duration === "N/A") throw new Error("Cannot send Telegram message: Invalid plan duration");

  const lines = [
    "🚀 NEW CANVA PRO REQUEST",
    "",
    "━━━━━━━━━━━━━━━━━━",
    "📦 PLAN DETAILS",
    "━━━━━━━━━━━━━━━━━━",
    "",
    `Plan: ${plan}`,
    `Duration: ${duration}`,
    "",
    "━━━━━━━━━━━━━━━━━━",
    "👤 CUSTOMER DETAILS",
    "━━━━━━━━━━━━━━━━━━",
    "",
    `Name: ${customerName}`,
    `Email: ${customerEmail}`,
    `WhatsApp: ${customerPhone}`,
    `Canva Email: ${canvaEmail}`,
    "",
    "━━━━━━━━━━━━━━━━━━",
    "💳 PAYMENT",
    "━━━━━━━━━━━━━━━━━━",
    "",
    `Reference Number: ${paymentDetails}`,
    `Payment Method: ${order.paymentMethod || "Bank Transfer"}`,
    `Payment Status: ${order.paymentStatus || "PENDING"}`,
    `Payment Slip: ${receiptFilename}`,
    "",
    "━━━━━━━━━━━━━━━━━━",
    "🕒 ORDER DETAILS",
    "━━━━━━━━━━━━━━━━━━",
    "",
    `Order ID: ${orderId}`,
    `Date: ${created.date}`,
    `Time: ${created.time}`,
    `Expiry Date: ${expiry.date}`,
    `Expiry Time: ${expiry.time}`,
  ];

  if (order.additionalInfo) {
    lines.push(`Remarks: ${order.additionalInfo}`);
  }

  appendPricingDetails(lines, order);

  const finalLines = [
    "🚀 NEW CANVA PRO REQUEST",
    "",
    "━━━━━━━━━━━━━━━━━━",
    "📦 PLAN DETAILS",
    "━━━━━━━━━━━━━━━━━━",
    "",
    `Plan: ${plan}`,
    `Duration: ${duration}`,
    "",
  ];

  if (order.discountType === "PROMOTION" || order.discountType === "PROMOTION + PROMO_CODE") {
    finalLines.push("🎁 PROMOTION APPLIED");
    finalLines.push(`Promotion: ${order.promotionName || "Promotion"}`);
  }

  if (order.discountType === "PROMO_CODE" || order.discountType === "PROMOTION + PROMO_CODE") {
    finalLines.push("🎟️ PROMO CODE APPLIED");
    finalLines.push(`Promo Code: ${order.promoCode || "PROMO"}`);
  }

  finalLines.push("", "━━━━━━━━━━━━━━━━━━", "💰 PRICING", "━━━━━━━━━━━━━━━━━━", "");
  finalLines.push(`Main Price: ${formatCurrency(order.mainPrice || order.planPrice || 0)}`);
  if (order.discountType === "PROMOTION" || order.discountType === "PROMOTION + PROMO_CODE") {
    finalLines.push(`Promotion Price: ${formatCurrency(order.promotionPrice || order.finalPrice || order.mainPrice || 0)}`);
    finalLines.push(`Promotion Discount Amount: ${formatCurrency(order.promotionDiscountAmount || 0)}`);
  }
  if (order.discountType === "PROMO_CODE" || order.discountType === "PROMOTION + PROMO_CODE") {
    finalLines.push(`Promo Code: ${order.promoCode || "PROMO"}`);
    finalLines.push(`Promo Discount Amount: ${formatCurrency(order.promoDiscountAmount || 0)}`);
  }
  if (order.discountType === "NONE") {
    finalLines.push("Discount: LKR 0");
  }
  finalLines.push(`Total Discount Amount: ${formatCurrency(order.discountAmount || 0)}`);
  finalLines.push(`Final Payable Price: ${formatCurrency(order.finalPrice ?? order.planPrice ?? 0)}`);
  finalLines.push("", "━━━━━━━━━━━━━━━━━━", "👤 CUSTOMER DETAILS", "━━━━━━━━━━━━━━━━━━", "");
  finalLines.push(`Name: ${customerName}`);
  finalLines.push(`Email: ${customerEmail}`);
  finalLines.push(`WhatsApp: ${customerPhone}`);
  finalLines.push(`Canva Email: ${canvaEmail}`);
  finalLines.push("", "━━━━━━━━━━━━━━━━━━", "💳 PAYMENT", "━━━━━━━━━━━━━━━━━━", "");
  finalLines.push(`Reference Number: ${paymentDetails}`);
  finalLines.push(`Payment Method: ${order.paymentMethod || "Bank Transfer"}`);
  finalLines.push(`Payment Status: ${order.paymentStatus || "PENDING"}`);
  finalLines.push(`Payment Slip: ${receiptFilename}`);
  finalLines.push("", "━━━━━━━━━━━━━━━━━━", "🕒 ORDER DETAILS", "━━━━━━━━━━━━━━━━━━", "");
  finalLines.push(`Order ID: ${orderId}`);
  finalLines.push(`Date: ${created.date}`);
  finalLines.push(`Time: ${created.time}`);
  finalLines.push(`Expiry Date: ${expiry.date}`);
  finalLines.push(`Expiry Time: ${expiry.time}`);

  if (order.additionalInfo) {
    finalLines.push(`Remarks: ${order.additionalInfo}`);
  }

  return finalLines.join("\n");
}

/**
 * Build the activation message for a paid order
 * Sent when Canva Pro access is activated (status becomes ACTIVE)
 */
export function buildPaidOrderActivationMessage(order: StoredOrder): string {
  const activation = requiredDateTime(order, order.activationDate, order.activationTime, "activation");
  const expiry = requiredExpiry(order);
  const orderId = requiredValue(order.orderId, "order number");
  const plan = requiredValue(order.selectedPlan, "plan");
  const duration = getPlanDurationDisplay(plan);
  const customerName = requiredValue(order.customerName, "full name");
  const customerEmail = requiredValue(order.customerEmail, "email address");
  const customerPhone = requiredValue(order.customerPhone, "WhatsApp number");
  const canvaEmail = requiredValue(order.canvaEmail, "Canva email");
  if (duration === "N/A") throw new Error("Cannot send Telegram message: Invalid plan duration");

  const lines = [
    "✅ CANVA PRO ACTIVATED",
    "",
    `🧾 Order Number: ${orderId}`,
    `💎 Plan: ${plan}`,
    `⏱️ Duration: ${duration}`,
    "",
    `👤 Full Name: ${customerName}`,
    `📧 Email Address: ${customerEmail}`,
    `📱 WhatsApp Number: ${customerPhone}`,
    `🎨 Canva Email: ${canvaEmail}`,
    "",
    `📅 Start Date: ${activation.date}`,
    `⏲️ Start Time: ${activation.time}`,
    `📅 EXPIRED ON: ${expiry.date}`,
    `⏲️ EXPIRED ON: ${expiry.time}`,
    "",
    `📦 Status: ACTIVE`,
  ];

  if (order.additionalInfo) {
    lines.push(`📝 Notes: ${order.additionalInfo}`);
  }

  return lines.join("\n");
}

/**
 * Build expiration message for a paid order
 * Sent when the plan period ends
 */
export function buildPaidOrderExpirationMessage(order: StoredOrder, sentAt = new Date()): string {
  const request = requiredDateTime(order, order.createdDate, order.createdTime, "request");
  requiredDateTime(order, order.activationDate, order.activationTime, "activation");
  const expiry = requiredExpiry(order);
  const orderId = requiredValue(order.orderId, "order number");
  const plan = requiredValue(order.selectedPlan, "plan");
  const duration = getPlanDurationDisplay(plan);
  const customerName = requiredValue(order.customerName, "full name");
  const customerEmail = requiredValue(order.customerEmail, "email address");
  const customerPhone = requiredValue(order.customerPhone, "WhatsApp number");
  const canvaEmail = requiredValue(order.canvaEmail, "Canva email");
  if (duration === "N/A") throw new Error("Cannot send Telegram message: Invalid plan duration");
  const titlePlan = order.planType === "YEARLY" || plan === "ANNUALLY" || plan === "Yearly" ? "YEARLY" : plan.toUpperCase();
  const notificationSent = getDateTimeInTimezone(sentAt, "Asia/Colombo");

  const lines = [
    `🚨 ${titlePlan} PLAN EXPIRED`,
    "",
    `🧾 Order Number: ${orderId}`,
    `💎 Plan: ${plan}`,
    `⏱️ Duration: ${duration}`,
    "",
    `👤 Full Name: ${customerName}`,
    `📧 Email Address: ${customerEmail}`,
    `📱 WhatsApp Number: ${customerPhone}`,
    `🎨 Canva Email: ${canvaEmail}`,
    "",
    `📅 Start Date: ${request.date}`,
    `⏲️ Start Time: ${request.time}`,
    `📅 EXPIRED ON: ${expiry.date}`,
    `⏲️ EXPIRED ON: ${expiry.time}`,
    `🕐 Notification Sent At: ${notificationSent.date} ${notificationSent.time}`,
    "",
    `📦 Status: EXPIRED`,
    "",
    "📦 Notification Type: SUBSCRIPTION_EXPIRED",
  ];

  return lines.join("\n");
}

/**
 * Build the message for a free trial request (REQUEST_SENT status)
 * Sent immediately after trial request submission with creation date/time
 */
export function buildTrialRequestMessage(order: StoredOrder): string {
  const created = requiredDateTime(order, order.createdDate, order.createdTime, "request");
  const expiry = requiredDateTime(order, order.trialEndDate, order.trialEndTime, "trial expiry");
  const customerName = requiredValue(order.customerName, "full name");
  const customerEmail = requiredValue(order.customerEmail, "email address");
  const customerPhone = requiredValue(order.customerPhone, "WhatsApp number");
  const canvaEmail = requiredValue(order.canvaEmail, "Canva email");

  const lines = [
    "✨ 3 DAYS FREE TRIAL REQUEST",
    "",
    `🆔 Request ID: ${requiredValue(order.requestId, "free trial request ID")}`,
    `👤 Full Name: ${customerName}`,
    `📧 Email Address: ${customerEmail}`,
    `📱 WhatsApp Number: ${customerPhone}`,
    `🎨 Canva Email Account: ${canvaEmail}`,
    "",
    `📅 Date: ${created.date}`,
    `⏲️ Time: ${created.time}`,
    `📅 EXPIRED ON: ${expiry.date}`,
    `⏲️ EXPIRED ON: ${expiry.time}`,
    "",
    `📦 Status: PENDING`,
  ];

  if (order.additionalInfo) {
    lines.push(`📝 Notes: ${order.additionalInfo}`);
  }

  return lines.join("\n");
}

/**
 * Build the activation message for a free trial
 * Sent when Free Trial access is activated (status becomes ACTIVE, trialStartAt is set)
 */
export function buildTrialActivationMessage(order: StoredOrder): string {
  const start = requiredDateTime(order, order.trialStartDate, order.trialStartTime, "trial activation");
  const end = requiredDateTime(order, order.trialEndDate, order.trialEndTime, "trial expiry");
  const customerName = requiredValue(order.customerName, "full name");
  const customerEmail = requiredValue(order.customerEmail, "email address");
  const customerPhone = requiredValue(order.customerPhone, "WhatsApp number");
  const canvaEmail = requiredValue(order.canvaEmail, "Canva email");

  const lines = [
    "✅ 3 DAYS FREE TRIAL ACTIVATED",
    "",
    `🆔 Request ID: ${requiredValue(order.requestId, "free trial request ID")}`,
    `👤 Full Name: ${customerName}`,
    `📧 Email Address: ${customerEmail}`,
    `📱 WhatsApp Number: ${customerPhone}`,
    `🎨 Canva Email Account: ${canvaEmail}`,
    "",
    `📅 Start Date: ${start.date}`,
    `⏲️ Start Time: ${start.time}`,
    `📅 EXPIRED ON: ${end.date}`,
    `⏲️ EXPIRED ON: ${end.time}`,
    "",
    `📦 Status: FREE_TRIAL_ACTIVE`,
  ];

  if (order.additionalInfo) {
    lines.push(`📝 Notes: ${order.additionalInfo}`);
  }

  return lines.join("\n");
}

export function buildTrialExpirationMessage(order: StoredOrder, sentAt = new Date()): string {
  const start = requiredDateTime(order, order.trialStartDate, order.trialStartTime, "trial activation");
  const end = requiredDateTime(order, order.trialEndDate, order.trialEndTime, "trial expiry");
  const customerName = requiredValue(order.customerName, "full name");
  const customerEmail = requiredValue(order.customerEmail, "email address");
  const customerPhone = requiredValue(order.customerPhone, "WhatsApp number");
  const canvaEmail = requiredValue(order.canvaEmail, "Canva email");
  const notificationSent = getDateTimeInTimezone(sentAt, "Asia/Colombo");

  return [
    "⏰ 3 DAYS FREE TRIAL EXPIRED",
    "",
    `🆔 Request ID: ${requiredValue(order.requestId, "free trial request ID")}`,
    `👤 Full Name: ${customerName}`,
    `📧 Email Address: ${customerEmail}`,
    `📱 WhatsApp Number: ${customerPhone}`,
    `🎨 Canva Email Account: ${canvaEmail}`,
    "",
    `📅 Start Date: ${start.date}`,
    `⏲️ Start Time: ${start.time}`,
    `📅 EXPIRED ON: ${end.date}`,
    `⏲️ EXPIRED ON: ${end.time}`,
    `🕐 Notification Sent At: ${notificationSent.date} ${notificationSent.time}`,
    "",
    "📦 Status: FREE_TRIAL_EXPIRED",
    "📦 Notification Type: SUBSCRIPTION_EXPIRED",
  ].join("\n");
}

/**
 * Build the automatic NEXT message sent after all successful Telegram workflows
 * EXACT FORMAT: Mandatory spacing and line breaks
 * - First line: 13 equals signs
 * - Second line: 4 spaces, NEXT, 1 space, two down arrows
 * - Third line: 13 equals signs
 */
export function buildNextMessage(): string {
  return "=============\n    NEXT 👇👇\n=============";
}
export function buildRefundRequestMessage(refundRequest: {
  refundRequestId: string;
  refundCode?: string;
  orderNumber: string;
  referenceNumber: string;
  customerName: string;
  email: string;
  whatsapp: string;
  canvaEmail: string;
  originalPlan?: string;
  originalPlanType?: string;
  originalPaidAmount?: number;
  requestedRefundAmount?: number;
  startedDate?: string;
  startedTime?: string;
  expiresDate?: string;
  expiresTime?: string;
  refundEligibleUntilDate?: string;
  refundEligibleUntilTime?: string;
  orderCreatedAt?: string;
  subscriptionStartedAt?: string;
  subscriptionExpiresAt?: string;
  activationStatus?: string;
  orderStatus?: string;
  paymentStatus?: string;
  paidAmount?: number;
  submittedAt?: string;
  refundReason?: string;
  additionalDetails?: string;
  status?: string;
}): string {
  const submittedAt = refundRequest.submittedAt ? new Date(refundRequest.submittedAt) : new Date();
  const { date: submittedDate, time: submittedTime } = getDateTimeInTimezone(submittedAt, "Asia/Colombo");
  const orderCreatedAt = refundRequest.orderCreatedAt ? new Date(refundRequest.orderCreatedAt) : submittedAt;
  const orderCreated = getDateTimeInTimezone(orderCreatedAt, "Asia/Colombo");
  const startedAt = refundRequest.subscriptionStartedAt ? new Date(refundRequest.subscriptionStartedAt) : submittedAt;
  const started = getDateTimeInTimezone(startedAt, "Asia/Colombo");
  const expiresAt = refundRequest.subscriptionExpiresAt ? new Date(refundRequest.subscriptionExpiresAt) : submittedAt;
  const expires = getDateTimeInTimezone(expiresAt, "Asia/Colombo");

  return [
    "💰 REFUND REQUEST",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    `🆔 Refund Request ID: ${refundRequest.refundRequestId}`,
    `🔐 Refund Code: ${refundRequest.refundCode || "N/A"}`,
    `🧾 Order Number: ${refundRequest.orderNumber}`,
    `🔖 Reference Number: ${refundRequest.referenceNumber}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "👤 CUSTOMER",
    "",
    `Name: ${refundRequest.customerName}`,
    `Email: ${refundRequest.email}`,
    `WhatsApp: ${refundRequest.whatsapp}`,
    `Canva Email: ${refundRequest.canvaEmail}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📦 SUBSCRIPTION",
    "",
    `Plan: ${refundRequest.originalPlan || "N/A"}`,
    `Paid Amount: Rs. ${refundRequest.paidAmount ?? refundRequest.originalPaidAmount ?? 0}`,
    `Activation Status: ${refundRequest.activationStatus || "NOT YET ACTIVATED"}`,
    `Order Status: ${refundRequest.orderStatus || "REQUEST_SENT"}`,
    `Payment Status: ${refundRequest.paymentStatus || "PENDING"}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📅 TIMING",
    "",
    `Order Created: ${orderCreated.date} ${orderCreated.time}`,
    `Subscription Started: ${refundRequest.subscriptionStartedAt ? `${started.date} ${started.time}` : "NOT ACTIVATED"}`,
    `Subscription Expires: ${refundRequest.subscriptionExpiresAt ? `${expires.date} ${expires.time}` : "NOT ACTIVATED"}`,
    `Refund Eligible Until: ${refundRequest.refundEligibleUntilDate || "N/A"} ${refundRequest.refundEligibleUntilTime || "N/A"}`,
    `Refund Submitted: ${submittedDate} ${submittedTime}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📝 REFUND REASON",
    refundRequest.refundReason || "N/A",
    "",
    "Additional Details:",
    refundRequest.additionalDetails || "None",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📊 REFUND STATUS:",
    refundRequest.status || "PENDING",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "⏱️ PROCESSING:",
    "Maximum review/processing time: 48 HOURS",
  ].join("\n");
}
/**
 * Escape markdown special characters for Telegram MarkdownV2 parsing
 */
export function escapeMarkdown(text: string): string {
  return String(text || "").replace(/([_*\[\]()`~`>#+\-=|{}.!])/g, "\\$1");
}
