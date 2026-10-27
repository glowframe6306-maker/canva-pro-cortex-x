import { NextRequest, NextResponse } from "next/server";
import { validatePromoCodeForPlan } from "@/lib/site-settings";
import { MissingApplicationSettingError } from "@/lib/application-settings-values";
import { isPromoValidationRequest } from "@/lib/promo-validation-request";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!isPromoValidationRequest(body)) {
      return NextResponse.json(
        { valid: false, message: "Promo code, plan, and a valid price are required." },
        { status: 400 },
      );
    }
    const { code, planId, originalPrice } = body;
    const result = await validatePromoCodeForPlan(code, planId, originalPrice);

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
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { valid: false, message: "Invalid promo validation request." },
        { status: 400 },
      );
    }
    if (error instanceof MissingApplicationSettingError) {
      return NextResponse.json(
        { valid: false, message: "Promo settings have not been restored." },
        { status: 503 },
      );
    }
    console.error("Promo validation failed.");
    return NextResponse.json(
      { valid: false, message: "Unable to validate promo code right now." },
      { status: 500 },
    );
  }
}
