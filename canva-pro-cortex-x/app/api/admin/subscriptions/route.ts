import { NextRequest, NextResponse } from "next/server";
import { getAllOrders, getSubscriptionNotificationLogs } from "@/lib/order-database";
import { hasAdminSession } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const orders = await getAllOrders();
  const subscriptions = orders
    .filter((order) => order.planType && order.planType !== "LIFETIME")
    .map((order) => ({
      requestId: order.requestId || order.orderId,
      customerName: order.customerName,
      email: order.customerEmail,
      whatsapp: order.customerPhone || "",
      canvaEmail: order.canvaEmail,
      planType: order.planType,
      planName: order.selectedPlan,
      duration: order.duration,
      startedAt: order.activatedAt || order.trialStartAt || "",
      expiresAt: order.expiryAt || order.trialEndAt || "",
      createdAt: order.createdAt || order.orderCreatedAt,
      updatedAt: order.updatedAt || order.orderCreatedAt,
      reminderAt: order.reminderAt || "",
      reminderDate: order.reminderDate || "",
      reminderTime: order.reminderTime || "",
      reminderStatus: order.reminderStatus || "PENDING",
      reminderSentAt: order.reminderSentAt || "",
      expiryNotificationStatus: order.expiryNotificationStatus || "PENDING",
      expiryNotificationSentAt: order.expirationNotificationSentAt || "",
      status: order.status || "PENDING",
    }));

  return NextResponse.json({ ok: true, subscriptions, notificationLogs: await getSubscriptionNotificationLogs() });
}