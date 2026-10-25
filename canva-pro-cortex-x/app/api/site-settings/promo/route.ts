import { NextRequest, NextResponse } from "next/server";
import { incrementPromoUsage, validatePromoCodeForPlan } from "@/lib/site-settings";

export async function POST(request: NextRequest) {
  try {
    const { code, planId, originalPrice } = await request.json();
    const result = await validatePromoCodeForPlan(String(code || ""), String(planId || ""), Number(originalPrice || 0));

    if (result.valid) {
      await incrementPromoUsage(String(code || ""));
    }

    return NextResponse.json({
      valid: result.valid,
      discount: result.discount,
      finalPrice: result.finalPrice,
      discountPercentage: Number(result.promo?.discountPercentage ?? result.promo?.value ?? 0),
      applicablePlans: Array.isArray(result.promo?.applicablePlans) ? result.promo.applicablePlans : [],
      code: result.promo?.code || String(code || "").trim().toUpperCase(),
      message: result.message,
      promo: result.promo || null,
    });
  } catch (error) {
    console.error("Promo validation error:", error);
    return NextResponse.json({ valid: false, discount: 0, finalPrice: Number(0), message: "Invalid or expired promo code." });
  }
}
