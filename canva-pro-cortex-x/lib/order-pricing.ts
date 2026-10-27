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

function formatCurrency(amount: number | string | undefined) {
  const value = Number(amount ?? 0);
  return `LKR ${value.toLocaleString("en-LK")}`;
}

export function getOrderPricingLines(order: StoredOrder): string[] {
  const mainPrice = Number(order.mainPrice ?? order.planPrice ?? 0);
  const finalPrice = Number(order.finalPrice ?? order.planPrice ?? mainPrice);
  const hasPromotion = order.discountType === "PROMOTION" || order.discountType === "PROMOTION + PROMO_CODE";
  const hasPromoCode = order.discountType === "PROMO_CODE" || order.discountType === "PROMOTION + PROMO_CODE";
  const totalDiscount = Math.max(0, mainPrice - finalPrice);

  return [
    "",
    "━━━━━━━━━━━━━━━━━━",
    "💰 PRICING",
    "━━━━━━━━━━━━━━━━━━",
    "",
    `Plan/Product: ${order.selectedPlan}`,
    `Original Price: ${formatCurrency(mainPrice)}`,
    `Promotion: ${hasPromotion ? order.promotionName || "Promotion" : "None"}`,
    `Promotion Discount Amount: ${formatCurrency(hasPromotion ? order.promotionDiscountAmount : 0)}`,
    `Promo Code: ${hasPromoCode ? order.promoCode || "PROMO" : "None"}`,
    `Promo Code Discount Amount: ${formatCurrency(hasPromoCode ? order.promoDiscountAmount : 0)}`,
    `Total Discount Amount: ${formatCurrency(totalDiscount)}`,
    `Final Payable Price: ${formatCurrency(finalPrice)}`,
    "Currency: LKR",
  ];
}
