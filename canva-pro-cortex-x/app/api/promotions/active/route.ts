/**
 * Public API endpoint to get active promotion
 * Used by the website to display the limited-time offer banner
 */

import { NextRequest, NextResponse } from "next/server";
import { getActivePromotion } from "@/lib/promotion-database";

export async function GET(request: NextRequest) {
  try {
    const activePromo = await getActivePromotion();
    return NextResponse.json({ ok: true, promotion: activePromo });
  } catch (error) {
    console.error("Active promotion API error:", error);
    return NextResponse.json({ ok: true, promotion: null }); // Return null instead of error so website doesn't break
  }
}
