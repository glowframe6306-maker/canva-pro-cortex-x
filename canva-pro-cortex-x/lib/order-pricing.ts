import type { PricingState } from "@/lib/pricing";
import type { StoredOrder } from "@/lib/order-database";

export function getOrderPricingFields(pricing: PricingState): Pick<
  StoredOrder,
  | "mainPrice"
  | "promotionPrice"
  | "promotionDiscountPercentage"
  | "promotionDiscountAmount"
  | "promotionApplied"
  | "promoCode"
  | "promoCodeOfferDiscountAmount"
  | "promoDiscountAmount"
  | "promoCodeApplied"
  | "discountType"
  | "discountPercentage"
  | "discountAmount"
  | "finalPrice"
  | "planPrice"
> {
  const totalDiscount = Math.max(0, pricing.mainPrice - pricing.finalPrice);
  const discountType = {
    main: "NONE",
    promotion: "PROMOTION",
    "promo-code": "PROMO_CODE",
    stacked: "PROMOTION + PROMO_CODE",
  }[pricing.priceSource] as NonNullable<StoredOrder["discountType"]>;
  const promotionWasApplied = pricing.promotionApplied;

  return {
    mainPrice: pricing.mainPrice,
    promotionPrice: promotionWasApplied ? pricing.promotionPrice : undefined,
    promotionDiscountPercentage: promotionWasApplied && pricing.mainPrice > 0
      ? Math.round((pricing.promotionDiscount / pricing.mainPrice) * 100)
      : undefined,
    promotionDiscountAmount: promotionWasApplied ? pricing.promotionDiscount : undefined,
    promotionApplied: pricing.promotionApplied,
    promoCode: pricing.promoCode?.toUpperCase() || undefined,
    promoCodeOfferDiscountAmount: pricing.promoCode ? pricing.promoDiscount : undefined,
    promoDiscountAmount: pricing.promoCodeApplied ? pricing.appliedPromoDiscount : undefined,
    promoCodeApplied: pricing.promoCodeApplied,
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
  const hasPromotion = order.promotionPrice !== undefined && order.promotionDiscountAmount !== undefined;
  const hasPromoCode = Boolean(order.promoCode);
  const totalDiscount = Math.max(0, mainPrice - finalPrice);

  return [
    "",
    "━━━━━━━━━━━━━━━━━━",
    "💰 PRICING",
    "━━━━━━━━━━━━━━━━━━",
    "",
    `Plan/Product: ${order.selectedPlan}`,
    `Original Price: ${formatCurrency(mainPrice)}`,
    `Promotion: ${hasPromotion ? `${order.promotionName || "Promotion"}${order.promotionApplied === false ? " (not applied; promo code price selected)" : ""}` : "None"}`,
    `Promotion Discount Amount: ${formatCurrency(hasPromotion ? order.promotionDiscountAmount : 0)}${hasPromotion && order.promotionApplied === false ? " (not applied)" : ""}`,
    `Promo Code: ${hasPromoCode ? `${order.promoCode || "PROMO"}${order.promoCodeApplied === false ? " (not applied; promotion price selected)" : ""}` : "None"}`,
    `Promo Code Discount Amount: ${formatCurrency(hasPromoCode ? order.promoCodeApplied === false ? order.promoCodeOfferDiscountAmount : order.promoDiscountAmount : 0)}${hasPromoCode && order.promoCodeApplied === false ? " (not applied)" : ""}`,
    `Total Discount Amount: ${formatCurrency(totalDiscount)}`,
    `Final Payable Price: ${formatCurrency(finalPrice)}`,
    "Currency: LKR",
  ];
}
