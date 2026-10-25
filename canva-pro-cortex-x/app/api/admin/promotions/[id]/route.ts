import { NextRequest, NextResponse } from "next/server";
import {
  deletePromotion,
  getPromotionById,
  togglePromotionStatus,
  updatePromotion,
} from "@/lib/promotion-database";
import { hasAdminSession } from "@/lib/admin-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Promotion ID required" }, { status: 400 });
    }

    const promotion = await getPromotionById(id);
    if (!promotion) {
      return NextResponse.json({ ok: false, error: "Promotion not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, promotion });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch promotion";
    console.error("Promotion detail GET error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
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
    console.error("Promotion detail PUT error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Promotion ID required" }, { status: 400 });
    }

    const deleted = await deletePromotion(id);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Promotion not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "Promotion deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete promotion";
    console.error("Promotion detail DELETE error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!hasAdminSession(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Promotion ID required" }, { status: 400 });
    }

    const updatedPromo = await togglePromotionStatus(id);
    if (!updatedPromo) {
      return NextResponse.json({ ok: false, error: "Promotion not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, promotion: updatedPromo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to toggle promotion";
    console.error("Promotion toggle POST error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
