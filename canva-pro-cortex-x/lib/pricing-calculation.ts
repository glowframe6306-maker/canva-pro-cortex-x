export type CalculatedPricing = {
  mainPrice: number;
  promotionPrice: number;
  promotionDiscount: number;
  promotionName?: string;
  promotionId?: string;
  promoCode: string | null;
  promoDiscount: number;
  finalPrice: number;
  hasActivePromotion: boolean;
  discountStacking: boolean;
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
  let promoDiscount = 0;
  let promoCode: string | null = null;
  let priceSource: CalculatedPricing["priceSource"] = hasActivePromotion ? "promotion" : "main";

  if (input.promoCode) {
    const promoValuePrice = Math.max(0, mainPrice - enteredPromoDiscount);

    if (hasActivePromotion && input.discountStacking) {
      promoCode = input.promoCode;
      promoDiscount = Math.min(enteredPromoDiscount, promotionPrice);
      finalPrice = promotionPrice - promoDiscount;
      priceSource = "stacked";
    } else if (!hasActivePromotion || promoValuePrice < promotionPrice) {
      promoCode = input.promoCode;
      promoDiscount = enteredPromoDiscount;
      finalPrice = promoValuePrice;
      priceSource = "promo-code";
    }
  }

  return {
    mainPrice,
    promotionPrice,
    promotionDiscount: hasActivePromotion ? promotionDiscount : 0,
    promotionName: hasActivePromotion ? input.promotionName : undefined,
    promotionId: hasActivePromotion ? input.promotionId : undefined,
    promoCode,
    promoDiscount,
    finalPrice,
    hasActivePromotion,
    discountStacking: input.discountStacking,
    priceSource,
  };
}
