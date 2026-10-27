export function normalizePromoCode(code: string) {
  return String(code || "").trim().replace(/\s+/g, "").toUpperCase();
}

export function getPromoCodeDiscountAmount(originalPrice: number, discountPercentage: number) {
  const basePrice = Number(originalPrice) || 0;
  const percentage = Number.isFinite(discountPercentage) ? Math.max(0, Math.min(Number(discountPercentage), 100)) : 0;
  return Math.min(basePrice, Math.round((basePrice * percentage) / 100));
}

export function validatePromoCodeForPlanInList<T extends {
  code: string;
  name?: string;
  enabled: boolean;
  applicablePlans: string[];
  startDate?: string;
  startTime?: string;
  expiryDate?: string;
  expiryTime?: string;
  usageLimit?: number;
  usedCount: number;
  discountPercentage?: number;
  value?: number;
}>(code: string, planId: string, originalPrice: number, promos: T[], now = new Date()) {
  const normalized = normalizePromoCode(code);
  const normalizedPlan = String(planId || "").trim().toLowerCase();

  if (!normalized) {
    return { valid: false, discount: 0, finalPrice: originalPrice, message: "Please enter a promo code." };
  }

  const promo = promos.find((item) => normalizePromoCode(item.code) === normalized);
  if (!promo) {
    return { valid: false, discount: 0, finalPrice: originalPrice, message: "Invalid or expired promo code." };
  }

  if (!promo.enabled) {
    return { valid: false, discount: 0, finalPrice: originalPrice, message: "This promo code is currently disabled." };
  }

  if (!isWithinPromoWindow(promo, now)) {
    return { valid: false, discount: 0, finalPrice: originalPrice, message: "This promo code is not active yet or has expired." };
  }

  const planList = (promo.applicablePlans || []).map((item) => String(item || "").trim().toLowerCase());
  if (planList.length > 0 && !planList.includes(normalizedPlan)) {
    return { valid: false, discount: 0, finalPrice: originalPrice, message: "This promo code is not valid for the selected plan." };
  }

  const usageLimit = Number(promo.usageLimit ?? 0);
  if (usageLimit > 0 && Number(promo.usedCount || 0) >= usageLimit) {
    return { valid: false, discount: 0, finalPrice: originalPrice, message: "This promo code usage limit has been reached." };
  }

  const discountPercentage = Number(promo.discountPercentage ?? promo.value ?? 0);
  if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
    return { valid: false, discount: 0, finalPrice: originalPrice, message: "This promo code discount is invalid." };
  }

  const discount = getPromoCodeDiscountAmount(originalPrice, discountPercentage);
  const finalPrice = Math.max(0, originalPrice - discount);

  return {
    valid: true,
    discount,
    finalPrice,
    message: `${promo.name || promo.code} applied successfully.`,
    promo,
  };
}

function isWithinPromoWindow(promo: {
  startDate?: string;
  startTime?: string;
  expiryDate?: string;
  expiryTime?: string;
}, now: Date) {
  if (promo.startDate || promo.startTime) {
    const startText = `${promo.startDate || "1970-01-01"}T${promo.startTime || "00:00"}`;
    const startAt = new Date(startText);
    if (!Number.isNaN(startAt.getTime()) && now < startAt) return false;
  }

  if (promo.expiryDate || promo.expiryTime) {
    const expiryText = `${promo.expiryDate || "1970-01-01"}T${promo.expiryTime || "23:59"}`;
    const expiryAt = new Date(expiryText);
    if (!Number.isNaN(expiryAt.getTime()) && now > expiryAt) return false;
  }

  return true;
}

export function validatePromoCodeEntry(
  promo: {
    id?: string;
    code?: string;
    name?: string;
    discountPercentage?: number;
    value?: number;
    applicablePlans?: string[];
    startDate?: string;
    startTime?: string;
    expiryDate?: string;
    expiryTime?: string;
    usageLimit?: number;
  },
  allPromos: Array<{ id?: string; code?: string }> = []
) {
  const code = normalizePromoCode(String(promo.code || ""));
  const name = String(promo.name || "").trim();
  const discountPercentage = Number(promo.discountPercentage ?? promo.value ?? 0);
  const applicablePlans = Array.isArray(promo.applicablePlans) ? promo.applicablePlans : [];
  const usageLimit = Number(promo.usageLimit ?? 0);

  if (!code) return "Promo Code is required.";
  if (!name) return "Promo Name is required.";
  if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
    return "Discount percentage must be between 0 and 100.";
  }
  if (!applicablePlans.length) return "At least one applicable plan must be selected.";

  if (promo.startDate || promo.startTime) {
    const startAt = new Date(`${promo.startDate || "1970-01-01"}T${promo.startTime || "00:00"}`);
    if (Number.isNaN(startAt.getTime())) return "Start date/time is invalid.";
  }

  if (promo.expiryDate || promo.expiryTime) {
    const expiryAt = new Date(`${promo.expiryDate || "1970-01-01"}T${promo.expiryTime || "23:59"}`);
    if (Number.isNaN(expiryAt.getTime())) return "Expiry date/time is invalid.";

    if (promo.startDate || promo.startTime) {
      const startAt = new Date(`${promo.startDate || "1970-01-01"}T${promo.startTime || "00:00"}`);
      if (!Number.isNaN(startAt.getTime()) && expiryAt <= startAt) {
        return "Expiry must be after the start time.";
      }
    }
  }

  if (usageLimit < 0) return "Usage limit cannot be negative.";

  const duplicate = allPromos.some(
    (candidate) => candidate.id !== promo.id && normalizePromoCode(String(candidate.code || "")) === code
  );
  if (duplicate) return "Promo Code must be unique.";

  return null;
}
