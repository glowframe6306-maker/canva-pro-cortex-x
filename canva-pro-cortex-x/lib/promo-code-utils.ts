export function normalizePromoCode(code: string) {
  return String(code || "").trim().replace(/\s+/g, "").toUpperCase();
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
