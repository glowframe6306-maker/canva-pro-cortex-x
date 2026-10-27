import type { PricingState } from "@/lib/pricing";
import type { StoredOrder } from "@/lib/order-database";

export function getOrderPricingFields(pricing: PricingState): Pick<
  StoredOrder,
  | "mainPrice"
  | "promotionPrice"
  | "promotionDiscountPercentage"
  | "promotionDiscountAmount"
  | "promoCode"
  | "promoDiscountAmount"
  | "discountType"
  | "discountPercentage"
  | "discountAmount"
  | "finalPrice"
  | "planPrice"
> {
  const promoWasApplied = pricing.priceSource === "promo-code" || pricing.priceSource === "stacked";
  const totalDiscount = Math.max(0, pricing.mainPrice - pricing.finalPrice);
  const discountType = {
    main: "NONE",
    promotion: "PROMOTION",
    "promo-code": "PROMO_CODE",
    stacked: "PROMOTION + PROMO_CODE",
  }[pricing.priceSource] as NonNullable<StoredOrder["discountType"]>;

  return {
    mainPrice: pricing.mainPrice,
    promotionPrice: pricing.hasActivePromotion ? pricing.promotionPrice : undefined,
    promotionDiscountPercentage: pricing.hasActivePromotion && pricing.mainPrice > 0
      ? Math.round((pricing.promotionDiscount / pricing.mainPrice) * 100)
      : undefined,
    promotionDiscountAmount: pricing.hasActivePromotion ? pricing.promotionDiscount : undefined,
    promoCode: promoWasApplied ? pricing.promoCode?.toUpperCase() : undefined,
    promoDiscountAmount: promoWasApplied ? pricing.promoDiscount : undefined,
    discountType,
    discountPercentage: pricing.mainPrice > 0 ? Math.round((totalDiscount / pricing.mainPrice) * 100) : 0,
    discountAmount: totalDiscount,
    finalPrice: pricing.finalPrice,
    planPrice: String(pricing.finalPrice),
  };
}
