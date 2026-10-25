/**
 * Admin API endpoint to view and manage orders
 *
 * GET /api/admin/orders - Get all orders
 * GET /api/admin/orders?status=REQUEST_SENT - Get orders by status
 * POST /api/admin/orders/activate - Activate an order
 */

import { NextRequest, NextResponse } from "next/server";
import { calculateExpiry, getDateTimeInTimezone, getPlanDurationDisplay, planNameToPlanType } from "@/lib/expiry-calculator";
import { activateOrderIfPending, getAllOrders, getOrdersByStatus, getOrderById, normalizeStoredStatus, updateOrder } from "@/lib/order-database";
import { hasAdminSession } from "@/lib/admin-auth";

function normalizeOrderStatus(status?: string): string {
  return normalizeStoredStatus(status);
}

export async function GET(request: NextRequest) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const status = request.nextUrl.searchParams.get("status");
    const orderId = request.nextUrl.searchParams.get("orderId");
    const allowedStatus = status as any;

    let orders;
    if (orderId) {
      const order = await getOrderById(orderId);
      orders = order ? [order] : [];
    } else if (allowedStatus) {
      orders = await getOrdersByStatus(allowedStatus);
    } else {
      orders = await getAllOrders();
    }

    return NextResponse.json({
      ok: true,
      count: orders.length,
      orders: orders.map((order) => ({
        orderId: order.orderId,
        requestId: order.requestId || order.orderId,
        referenceNumber: order.paymentDetails || order.requestId || order.orderId,
        paymentReference: order.paymentDetails || "",
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        canvaEmail: order.canvaEmail,
        customerPhone: order.customerPhone || "",
        selectedPlan: order.selectedPlan,
        planPrice: order.planPrice,
        paymentMethod: order.paymentMethod,
        paymentDetails: order.paymentDetails || "",
        status: normalizeOrderStatus(order.status),
        activatedAt: order.activatedAt || null,
        activationDate: order.activationDate || null,
        activationTime: order.activationTime || null,
        expiryAt: order.expiryAt || null,
        expiryDate: order.expiryDate || null,
        expiryTime: order.expiryTime || null,
        reminderAt: order.reminderAt || null,
        reminderDate: order.reminderDate || null,
        reminderTime: order.reminderTime || null,
        reminderStatus: order.reminderStatus || "PENDING",
        reminderSentAt: order.reminderSentAt || null,
        expiryNotificationStatus: order.expiryNotificationStatus || "PENDING",
        expirationNotificationSentAt: order.expirationNotificationSentAt || null,
        durationDays: order.durationDays || null,
        expirationNotificationSent: order.expirationNotificationSent || false,
        orderCreatedAt: order.orderCreatedAt,
        createdAt: order.createdAt || order.orderCreatedAt,
        approvedAt: order.approvedAt || null,
        rejectedAt: order.rejectedAt || null,
        expiredAt: order.expiredAt || null,
        paymentProof: order.receiptFilename || null,
        paymentProofUrl: order.receiptFilename
          ? `/api/admin/orders/${encodeURIComponent(order.orderId)}/receipt`
          : null,
      })),
    });
  } catch (error) {
    console.error("Admin orders API error:", error);
    return NextResponse.json({ ok: false, error: "Unable to fetch orders." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { action, orderId, rejectionReason } = await request.json();
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ ok: false, error: "Order ID is required." }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
    }

    if (action === "reject") {
      const rejectedStatus = normalizeOrderStatus(order.status);
      if (rejectedStatus === "ACTIVE" || rejectedStatus === "EXPIRED" || rejectedStatus === "REJECTED") {
        return NextResponse.json({ ok: false, error: `Order is already in ${rejectedStatus} status.` }, { status: 400 });
      }

      const updated = await updateOrder(orderId, {
        status: "REJECTED",
        rejectedAt: new Date().toISOString(),
        additionalInfo: rejectionReason ? `${order.additionalInfo || ""} ${rejectionReason}`.trim() : order.additionalInfo,
      });
      return NextResponse.json({ ok: true, message: "Order rejected.", order: updated });
    }

    if (action === "activate") {
      const currentStatus = normalizeOrderStatus(order.status);
      if (currentStatus !== "PENDING") {
        return NextResponse.json({ ok: false, error: "Order is no longer pending." }, { status: 400 });
      }

      const planType = planNameToPlanType(order.selectedPlan || "WEEKLY") || "WEEKLY";
      const now = new Date();
      const expiry = calculateExpiry(planType, now);
      const reminderTime = expiry && expiry.expiryAt ? new Date(new Date(expiry.expiryAt).getTime() - 24 * 60 * 60 * 1000) : null;
      const reminder = reminderTime ? getDateTimeInTimezone(reminderTime, "Asia/Colombo") : null;

      const updated = await activateOrderIfPending(orderId, {
        status: "ACTIVE",
        approvedAt: new Date().toISOString(),
        activatedAt: now.toISOString(),
        activationDate: getDateTimeInTimezone(now, "Asia/Colombo").date,
        activationTime: getDateTimeInTimezone(now, "Asia/Colombo").time,
        expiryAt: expiry?.expiryAt || undefined,
        expiryDate: expiry?.expiryDate || undefined,
        expiryTime: expiry?.expiryTime || undefined,
        durationDays: expiry?.durationDays || 0,
        planType: planType === "YEARLY" ? "YEARLY" : planType,
        duration: getPlanDurationDisplay(planType),
        reminderAt: reminderTime?.toISOString(),
        reminderDate: reminder?.date,
        reminderTime: reminder?.time,
        reminderStatus: reminderTime ? "PENDING" : undefined,
        expiryNotificationStatus: "PENDING",
      });

      if (!updated) {
        return NextResponse.json({ ok: false, error: "Order is no longer pending." }, { status: 400 });
      }

      return NextResponse.json({ ok: true, message: "Subscription activated.", order: updated });
    }

    return NextResponse.json({ ok: false, error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    console.error("Admin order action error:", error);
    return NextResponse.json({ ok: false, error: "Unable to process the request." }, { status: 500 });
  }
}
