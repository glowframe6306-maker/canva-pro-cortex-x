export type PromoValidationRequest = {
  code: string;
  planId: string;
  originalPrice: number;
};

export function isPromoValidationRequest(value: unknown): value is PromoValidationRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const request = value as Partial<PromoValidationRequest>;
  return typeof request.code === "string"
    && typeof request.planId === "string"
    && typeof request.originalPrice === "number"
    && Number.isFinite(request.originalPrice)
    && request.originalPrice >= 0;
}
