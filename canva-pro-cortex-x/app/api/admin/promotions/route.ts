/**
 * Admin API endpoint to manage promotions
 *
 * GET /api/admin/promotions - Get all promotions
 * GET /api/admin/promotions/active - Get active promotion
 * POST /api/admin/promotions - Create new promotion
 * PUT /api/admin/promotions/:id - Update promotion
 * DELETE /api/admin/promotions/:id - Delete promotion
 * POST /api/admin/promotions/:id/toggle - Toggle promotion status
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllPromotions,
  getActivePromotion,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
  togglePromotionStatus,
  type Promotion,
} from "@/lib/promotion-database";
import { hasAdminSession } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const pathname = request.nextUrl.pathname;

    // GET /api/admin/promotions/active
    if (pathname.includes("/active")) {
      const activePromo = await getActivePromotion();
      return NextResponse.json({ ok: true, promotion: activePromo });
    }

    // GET /api/admin/promotions/:id
    const urlParts = pathname.split("/");
    const id = urlParts[urlParts.length - 1];

    if (id && id !== "promotions" && id !== "active") {
      const promotion = await getPromotionById(id);
      if (!promotion) {
        return NextResponse.json({ ok: false, error: "Promotion not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, promotion });
    }

    // GET /api/admin/promotions
    const promotions = await getAllPromotions();
    return NextResponse.json({ ok: true, promotions });
  } catch (error) {
    console.error("Promotions API GET error:", error);
    return NextResponse.json({ ok: false, error: "Unable to fetch promotions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const pathname = request.nextUrl.pathname;
    const urlParts = pathname.split("/").filter(Boolean);
    const toggleId = pathname.includes("/toggle") ? urlParts[urlParts.length - 2] : undefined;

    // POST /api/admin/promotions/:id/toggle
    if (pathname.includes("/toggle") && toggleId) {
      const updatedPromo = await togglePromotionStatus(toggleId);
      if (!updatedPromo) {
        return NextResponse.json({ ok: false, error: "Promotion not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, promotion: updatedPromo });
    }

    // POST /api/admin/promotions - Create new
    const body = await request.json();
    const newPromo = await createPromotion(body);
    return NextResponse.json({ ok: true, promotion: newPromo }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create/update promotion";
    console.error("Promotions API POST error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const pathname = request.nextUrl.pathname;
    const urlParts = pathname.split("/");
    const id = urlParts[urlParts.length - 1];

    if (!id || id === "promotions") {
      return NextResponse.json({ ok: false, error: "Promotion ID required" }, { status: 400 });
    }

    const body = await request.json();
    const updatedPromo = await updatePromotion(id, body);

    if (!updatedPromo) {
      return NextResponse.json({ ok: false, error: "Promotion not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, promotion: updatedPromo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update promotion";
    console.error("Promotions API PUT error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const pathname = request.nextUrl.pathname;
    const urlParts = pathname.split("/");
    const id = urlParts[urlParts.length - 1];

    if (!id || id === "promotions") {
      return NextResponse.json({ ok: false, error: "Promotion ID required" }, { status: 400 });
    }

    const deleted = await deletePromotion(id);

    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Promotion not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "Promotion deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete promotion";
    console.error("Promotions API DELETE error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
