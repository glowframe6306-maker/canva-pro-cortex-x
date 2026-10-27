import { plans as basePlans } from "@/components/site-data";
import { getActivePromotion, getPromotionOfferForPlan } from "@/lib/promotion-database";
import { getSiteSettings, normalizePromoCode, validatePromoCodeForPlan } from "@/lib/site-settings";
import { calculatePlanPricing } from "@/lib/pricing-calculation";

export type PricingState = ReturnType<typeof calculatePlanPricing> & {
  planId: string;
};

export function getMainPlanPrice(planId: string) {
  const normalized = String(planId || "").trim().toLowerCase();
  const plan = basePlans.find((candidate) => candidate.id.toLowerCase() === normalized);
  return Number(plan?.price || 0);
}

export function getPromotionPriceForPlan(planId: string, promotion: any = null) {
  const mainPrice = getMainPlanPrice(planId);
  const offer = promotion ? getPromotionOfferForPlan(promotion, planId) : null;

  if (!offer || offer.promotionalPrice >= mainPrice) {
    return {
      hasActivePromotion: false,
      promotionPrice: mainPrice,
      promotionDiscount: 0,
    };
  }

  return {
    hasActivePromotion: true,
    promotionPrice: offer.promotionalPrice,
    promotionDiscount: offer.discountAmount,
  };
}

export async function resolvePlanPricing(planId: string, enteredPromoCode?: string): Promise<PricingState> {
  const planKey = String(planId || "").trim();
  const mainPrice = getMainPlanPrice(planKey);
  const promotion = await getActivePromotion(planKey);
  const promotionResult = getPromotionPriceForPlan(planKey, promotion);
  const settings = await getSiteSettings();
  const discountStacking = Boolean(settings.discountStacking);

  const normalizedCode = String(enteredPromoCode || "").trim();
  let validatedPromoCode: string | undefined;
  let validatedPromoDiscount = 0;
  if (normalizedCode) {
    const promoValidation = await validatePromoCodeForPlan(normalizedCode, planKey, mainPrice);
    if (promoValidation.valid) {
      validatedPromoCode = normalizePromoCode(promoValidation.promo?.code || normalizedCode);
      validatedPromoDiscount = promoValidation.discount;
    }
  }

  return {
    planId: planKey,
    ...calculatePlanPricing({
      mainPrice,
      promotionPrice: promotionResult.hasActivePromotion ? promotionResult.promotionPrice : undefined,
      promotionName: promotion?.name,
      promotionId: promotion?.id,
      promoCode: validatedPromoCode,
      promoDiscount: validatedPromoDiscount,
      discountStacking,
    }),
  };
}
