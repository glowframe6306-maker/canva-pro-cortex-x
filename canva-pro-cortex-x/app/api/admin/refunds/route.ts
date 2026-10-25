import { NextRequest, NextResponse } from "next/server";
import { getAllRefundRequests, updateRefundRequestStatus } from "@/lib/refund-database";
import { getOrderByOrderNumber } from "@/lib/order-database";
import { hasAdminSession } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const filter = request.nextUrl.searchParams.get("filter") || "all";
    const includeOrder = request.nextUrl.searchParams.get("includeOrder") === "true";
    const requests = await getAllRefundRequests();
    const filtered = filter === "pending"
      ? requests.filter((request) => ["PENDING", "UNDER_REVIEW"].includes(request.status))
      : filter === "approved"
        ? requests.filter((request) => ["APPROVED"].includes(request.status))
        : filter === "rejected"
          ? requests.filter((request) => ["REJECTED"].includes(request.status))
          : requests;

    // Optionally include original order for detailed view
    const enriched = includeOrder ? await Promise.all(
      filtered.map(async (refund) => {
        const originalOrder = await getOrderByOrderNumber(refund.orderNumber);
        return {
          ...refund,
          originalOrder: originalOrder ? {
            customerName: originalOrder.customerName,
            customerEmail: originalOrder.customerEmail,
            customerPhone: originalOrder.customerPhone,
            canvaEmail: originalOrder.canvaEmail,
            selectedPlan: originalOrder.selectedPlan,
            planPrice: originalOrder.planPrice,
            paymentMethod: originalOrder.paymentMethod,
            paymentDetails: originalOrder.paymentDetails,
          } : null,
        };
      })
    ) : filtered;

    return NextResponse.json({ ok: true, count: filtered.length, refunds: enriched });
  } catch (error) {
    console.error("Admin refunds API error:", error);
    return NextResponse.json({ ok: false, error: "Unable to fetch refund requests." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { refundRequestId, action } = await request.json();
    if (!refundRequestId || typeof refundRequestId !== "string") {
      return NextResponse.json({ ok: false, error: "Refund request ID is required." }, { status: 400 });
    }

    const nextStatus = action === "APPROVE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : action === "PROCESSED" ? "PROCESSED" : "PENDING";
    const updated = await updateRefundRequestStatus(refundRequestId, nextStatus as any);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Refund request not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: `Refund request ${nextStatus.toLowerCase()}.`, refund: updated });
  } catch (error) {
    console.error("Admin refund update error:", error);
    return NextResponse.json({ ok: false, error: "Unable to update refund request." }, { status: 500 });
  }
}
