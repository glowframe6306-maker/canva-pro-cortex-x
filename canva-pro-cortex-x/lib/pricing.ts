import { plans as basePlans } from "@/components/site-data";
import { getActivePromotion, getPromotionOfferForPlan } from "@/lib/promotion-database";
import { getSiteSettings, validatePromoCodeForPlan } from "@/lib/site-settings";

export type PricingState = {
  planId: string;
  mainPrice: number;
  promotionPrice: number;
  promotionDiscount: number;
  promoCode: string | null;
  promoDiscount: number;
  finalPrice: number;
  hasActivePromotion: boolean;
  discountStacking: boolean;
  priceSource: "main" | "promotion" | "promo-code" | "stacked";
};

export function getMainPlanPrice(planId: string) {
  const normalized = String(planId || "").trim().toLowerCase();
  const plan = basePlans.find((candidate) => candidate.id.toLowerCase() === normalized);
  return Number(plan?.price || 0);
}

export function getPromotionPriceForPlan(planId: string, promotion: any = null) {
  const mainPrice = getMainPlanPrice(planId);
  const offer = promotion ? getPromotionOfferForPlan(promotion, planId) : null;

  if (!offer || !offer.promotionalPrice || offer.promotionalPrice >= mainPrice) {
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
  const promotion = await getActivePromotion();
  const promotionResult = getPromotionPriceForPlan(planKey, promotion);
  const settings = await getSiteSettings();
  const discountStacking = Boolean(settings.discountStacking);

  let finalPrice = mainPrice;
  let promoDiscount = 0;
  let promoCode = null;
  let priceSource: PricingState["priceSource"] = "main";

  if (promotionResult.hasActivePromotion) {
    finalPrice = promotionResult.promotionPrice;
    priceSource = "promotion";
  }

  const normalizedCode = String(enteredPromoCode || "").trim();
  if (normalizedCode) {
    const promoValidation = await validatePromoCodeForPlan(normalizedCode, planKey, mainPrice);
    if (promoValidation.valid) {
      promoDiscount = promoValidation.discount;
      promoCode = normalizedCode;

      const promoValuePrice = Math.max(0, mainPrice - promoDiscount);
      const promotionValuePrice = promotionResult.hasActivePromotion ? promotionResult.promotionPrice : mainPrice;

      if (!discountStacking && promotionResult.hasActivePromotion) {
        if (promoValuePrice < promotionValuePrice) {
          finalPrice = promoValuePrice;
          priceSource = "promo-code";
        }
      } else if (discountStacking && promotionResult.hasActivePromotion) {
        const stackedPrice = Math.max(0, promotionResult.promotionPrice - promoDiscount);
        finalPrice = stackedPrice;
        priceSource = "stacked";
      } else {
        finalPrice = promoValuePrice;
        priceSource = "promo-code";
      }
    }
  }

  return {
    planId: planKey,
    mainPrice,
    promotionPrice: promotionResult.hasActivePromotion ? promotionResult.promotionPrice : mainPrice,
    promotionDiscount: promotionResult.promotionDiscount,
    promoCode,
    promoDiscount,
    finalPrice,
    hasActivePromotion: promotionResult.hasActivePromotion,
    discountStacking,
    priceSource,
  };
}
