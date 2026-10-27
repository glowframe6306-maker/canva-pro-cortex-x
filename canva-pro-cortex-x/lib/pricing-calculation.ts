export type CalculatedPricing = {
  mainPrice: number;
  promotionPrice: number;
  promotionDiscount: number;
  promotionName?: string;
  promotionId?: string;
  promoCode: string | null;
  promoDiscount: number;
  appliedPromoDiscount: number;
  finalPrice: number;
  hasActivePromotion: boolean;
  discountStacking: boolean;
  promotionApplied: boolean;
  promoCodeApplied: boolean;
  priceSource: "main" | "promotion" | "promo-code" | "stacked";
};

export function calculatePlanPricing(input: {
  mainPrice: number;
  promotionPrice?: number;
  promotionName?: string;
  promotionId?: string;
  promoCode?: string;
  promoDiscount?: number;
  discountStacking: boolean;
}): CalculatedPricing {
  const mainPrice = Math.max(0, input.mainPrice);
  const promotionPrice = input.promotionPrice !== undefined && input.promotionPrice < mainPrice
    ? input.promotionPrice
    : mainPrice;
  const hasActivePromotion = promotionPrice < mainPrice;
  const promotionDiscount = mainPrice - promotionPrice;
  const enteredPromoDiscount = Math.min(mainPrice, Math.max(0, input.promoDiscount || 0));

  let finalPrice = promotionPrice;
  const promoDiscount = input.promoCode ? enteredPromoDiscount : 0;
  let appliedPromoDiscount = 0;
  const promoCode = input.promoCode || null;
  let promotionApplied = hasActivePromotion;
  let promoCodeApplied = false;
  let priceSource: CalculatedPricing["priceSource"] = hasActivePromotion ? "promotion" : "main";

  if (input.promoCode) {
    promotionApplied = false;
    promoCodeApplied = true;
    appliedPromoDiscount = enteredPromoDiscount;
    finalPrice = Math.max(0, mainPrice - enteredPromoDiscount);
    priceSource = "promo-code";
  }

  return {
    mainPrice,
    promotionPrice,
    promotionDiscount: hasActivePromotion ? promotionDiscount : 0,
    promotionName: hasActivePromotion ? input.promotionName : undefined,
    promotionId: hasActivePromotion ? input.promotionId : undefined,
    promoCode,
    promoDiscount,
    appliedPromoDiscount,
    finalPrice,
    hasActivePromotion,
    discountStacking: input.discountStacking,
    promotionApplied,
    promoCodeApplied,
    priceSource,
  };
}

export function calculateCheckoutPlanPrice(input: {
  mainPrice: number;
  promotionPrice?: number;
  promoCode?: string;
  promoDiscount?: number;
}): number {
  return calculatePlanPricing({
    ...input,
    discountStacking: false,
  }).finalPrice;
}
