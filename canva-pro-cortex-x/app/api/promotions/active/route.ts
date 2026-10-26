/**
 * Public API endpoint to get active promotion
 * Used by the website to display the limited-time offer banner
 */

import { NextRequest, NextResponse } from "next/server";
import { getActivePromotion } from "@/lib/promotion-database";
import { MissingApplicationSettingError } from "@/lib/application-settings-values";

export async function GET(request: NextRequest) {
  try {
    const activePromo = await getActivePromotion();
    return NextResponse.json({ ok: true, promotion: activePromo });
  } catch (error) {
    if (error instanceof MissingApplicationSettingError) {
      return NextResponse.json(
        { ok: false, error: "Promotions have not been migrated." },
        { status: 503 },
      );
    }
    console.error("Active promotion API error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to fetch active promotion." },
      { status: 500 },
    );
  }
}
