/**
 * Promotion database and persistence system
 * Stores and manages limited-time offers
 */

import fs from "node:fs/promises";
import path from "node:path";
import { plans as basePlans } from "@/components/site-data";

export type PromotionPlanKey = "weekly" | "monthly" | "annually" | "lifetime";

export type PromotionPlanPrice = {
  normalPrice: number;
  promotionalPrice: number;
  discountAmount: number;
  discountPercent: number;
  enabled: boolean;
};

export type PromotionPlanPrices = Record<PromotionPlanKey, PromotionPlanPrice>;

export interface Promotion {
  id: string;
  enabled: boolean;
  name: string;
  title: string;
  description: string;
  offerText: string;
  buttonText: string;
  buttonAction: string;
  applicablePlans: string[];
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  planPrices: PromotionPlanPrices;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const PROMOTIONS_FILE = path.join(DATA_DIR, "promotions.json");

const planOrder: PromotionPlanKey[] = ["weekly", "monthly", "annually", "lifetime"];

function normalizePlanKey(value: string): PromotionPlanKey {
  const key = String(value || "").trim().toLowerCase();
  if (key === "annual" || key === "annually" || key === "yearly") return "annually";
  if (key === "lifetime") return "lifetime";
  if (key === "monthly") return "monthly";
  if (key === "weekly") return "weekly";
  return "monthly";
}

function getBasePlanNormalPrice(planId: string): number {
  const normalized = normalizePlanKey(planId);
  if (normalized === "annually") return 2000;
  const plan = basePlans.find((candidate) => candidate.id === normalized);
  return plan?.price || 0;
}

export function buildPlanPriceEntry(planId: string, input?: Partial<PromotionPlanPrice>): PromotionPlanPrice {
  const normalized = normalizePlanKey(planId);
  const normalPrice = getBasePlanNormalPrice(normalized);
  const enteredValue = Number(input?.promotionalPrice ?? normalPrice);
  const promotionalPrice = Number.isFinite(enteredValue) ? Math.max(0, Math.min(enteredValue, normalPrice)) : normalPrice;
  const discountAmount = Math.max(0, normalPrice - promotionalPrice);
  const discountPercent = normalPrice > 0 ? Math.round((discountAmount / normalPrice) * 100) : 0;

  return {
    normalPrice,
    promotionalPrice,
    discountAmount,
    discountPercent,
    enabled: input?.enabled ?? true,
  };
}

export function getDefaultPlanPrices(): PromotionPlanPrices {
  return {
    weekly: buildPlanPriceEntry("weekly", { promotionalPrice: 200, enabled: true }),
    monthly: buildPlanPriceEntry("monthly", { promotionalPrice: 500, enabled: true }),
    annually: buildPlanPriceEntry("annually", { promotionalPrice: 2000, enabled: true }),
    lifetime: buildPlanPriceEntry("lifetime", { promotionalPrice: 5000, enabled: true }),
  };
}

function normalizePlanPrices(planPrices?: Partial<PromotionPlanPrices> | Record<string, any>): PromotionPlanPrices {
  const defaults = getDefaultPlanPrices();
  const result: PromotionPlanPrices = { ...defaults };
  const planMap = (planPrices ?? {}) as Record<string, any>;

  for (const planKey of planOrder) {
    const rawEntry = planMap[planKey] || planMap[planKey.toUpperCase()] || {};
    const nextValue = rawEntry && typeof rawEntry === "object" ? rawEntry : {};
    result[planKey] = buildPlanPriceEntry(planKey, {
      promotionalPrice: Number(nextValue.promotionalPrice ?? defaults[planKey].promotionalPrice),
      enabled: nextValue.enabled !== false,
    });
  }

  return result;
}

export function normalizePromotionPlanList(applicablePlans: string[] = []): string[] {
  const unique = new Set<string>();
  for (const entry of applicablePlans) {
    const normalized = normalizePlanKey(entry);
    unique.add(normalized);
  }
  return Array.from(unique);
}

function validatePromotionTiming(startDate?: string, startTime?: string, endDate?: string, endTime?: string) {
  const startDateText = String(startDate || "").trim();
  const startTimeText = String(startTime || "").trim();
  const endDateText = String(endDate || "").trim();
  const endTimeText = String(endTime || "").trim();

  if (startDateText || startTimeText) {
    const startAt = new Date(`${startDateText || "1970-01-01"}T${startTimeText || "00:00"}`);
    if (Number.isNaN(startAt.getTime())) {
      throw new Error("Start date/time is invalid.");
    }
  }

  if (endDateText || endTimeText) {
    const endAt = new Date(`${endDateText || "1970-01-01"}T${endTimeText || "23:59"}`);
    if (Number.isNaN(endAt.getTime())) {
      throw new Error("End date/time is invalid.");
    }

    if (startDateText || startTimeText) {
      const startAt = new Date(`${startDateText || "1970-01-01"}T${startTimeText || "00:00"}`);
      if (!Number.isNaN(startAt.getTime()) && endAt <= startAt) {
        throw new Error("End date/time must be after the start date/time.");
      }
    }
  }
}

function validatePlanPriceEntry(planId: string, entry: Partial<{ promotionalPrice?: number; enabled?: boolean }> | undefined, normalPrice: number) {
  const promoValue = Number(entry?.promotionalPrice ?? normalPrice);

  if (!Number.isFinite(promoValue)) {
    throw new Error(`Promotional price for ${planId} must be a valid number.`);
  }

  if (promoValue < 0) {
    throw new Error(`Promotional price for ${planId} cannot be negative.`);
  }

  if (promoValue > normalPrice) {
    throw new Error(`Promotional price for ${planId} cannot exceed the main price of Rs. ${normalPrice.toLocaleString()}.`);
  }

  return {
    promotionalPrice: promoValue,
    enabled: entry?.enabled ?? true,
  };
}

function validatePromotionInput(data: Partial<Promotion>, mode: "create" | "update" = "create") {
  const id = String(data.id || "").trim();
  if (mode === "update" && !id) {
    throw new Error("Promotion ID is required for updates.");
  }

  const name = String(data.name ?? data.title ?? "").trim();
  if (!name) {
    throw new Error("Promotion name is required.");
  }

  const startDate = String(data.startDate ?? "").trim();
  const startTime = String(data.startTime ?? "").trim();
  const endDate = String(data.endDate ?? "").trim();
  const endTime = String(data.endTime ?? "").trim();

  validatePromotionTiming(startDate, startTime, endDate, endTime);

  const planEntries = (data.planPrices && typeof data.planPrices === "object" ? data.planPrices : {}) as Record<string, any>;
  const planList = Array.isArray(data.applicablePlans) && data.applicablePlans.length ? normalizePromotionPlanList(data.applicablePlans) : planOrder;
  if (!planList.length) {
    throw new Error("At least one plan must be selected for the promotion.");
  }

  const normalizedPlanPrices: PromotionPlanPrices = { ...getDefaultPlanPrices() };
  for (const planKey of planOrder) {
    const entry = planEntries[planKey] as Partial<{ promotionalPrice?: number; enabled?: boolean }> | undefined;
    const basePrice = getBasePlanNormalPrice(planKey);
    const validated = validatePlanPriceEntry(planKey, entry, basePrice);
    normalizedPlanPrices[planKey] = {
      ...validated,
      normalPrice: basePrice,
      discountAmount: Math.max(0, basePrice - validated.promotionalPrice),
      discountPercent: basePrice > 0 ? Math.round(((basePrice - validated.promotionalPrice) / basePrice) * 100) : 0,
    };
  }

  return {
    name,
    title: name,
    description: String(data.description || "Limited-time promotional pricing for selected plans.").trim() || "Limited-time promotional pricing for selected plans.",
    offerText: String(data.offerText || "LIMITED-TIME OFFER").trim() || "LIMITED-TIME OFFER",
    buttonText: String(data.buttonText || "GET STARTED").trim() || "GET STARTED",
    buttonAction: String(data.buttonAction || "scroll-to-plans").trim() || "scroll-to-plans",
    enabled: data.enabled !== false,
    startDate: startDate || undefined,
    startTime: startTime || undefined,
    endDate: endDate || undefined,
    endTime: endTime || undefined,
    applicablePlans: planList,
    planPrices: normalizedPlanPrices,
  };
}

export function getPromotionOfferForPlan(promotion: Promotion | null | undefined, planId: string): {
  active: boolean;
  normalPrice: number;
  promotionalPrice: number;
  discountAmount: number;
  discountPercent: number;
  isDiscounted: boolean;
  enabled: boolean;
} | null {
  if (!promotion || !promotion.enabled) {
    return null;
  }

  const normalized = normalizePlanKey(planId);
  const planEntry = promotion.planPrices?.[normalized];
  if (!planEntry || !planEntry.enabled) {
    return null;
  }

  const active = isPromotionActive(promotion);
  const applicablePlans = promotion.applicablePlans?.length ? promotion.applicablePlans : planOrder;
  if (!active || !applicablePlans.includes(normalized)) {
    return null;
  }

  const basePrice = getBasePlanNormalPrice(normalized);
  const promotionalPrice = Number(planEntry.promotionalPrice ?? basePrice);
  const effectivePromoPrice = Number.isFinite(promotionalPrice) ? Math.max(0, Math.min(promotionalPrice, basePrice)) : basePrice;
  const discountAmount = Math.max(0, basePrice - effectivePromoPrice);
  const discountPercent = basePrice > 0 ? Math.round((discountAmount / basePrice) * 100) : 0;

  return {
    active: true,
    normalPrice: basePrice,
    promotionalPrice: effectivePromoPrice,
    discountAmount,
    discountPercent,
    isDiscounted: effectivePromoPrice < basePrice,
    enabled: planEntry.enabled,
  };
}

export function isPromotionActive(promotion: Promotion | null | undefined, now = new Date()): boolean {
  if (!promotion || !promotion.enabled) return false;

  if (promotion.startDate && promotion.startTime) {
    const startAt = new Date(`${promotion.startDate}T${promotion.startTime}`);
    if (Number.isNaN(startAt.getTime()) || now < startAt) return false;
  }

  if (promotion.endDate && promotion.endTime) {
    const endAt = new Date(`${promotion.endDate}T${promotion.endTime}`);
    if (Number.isNaN(endAt.getTime()) || now > endAt) return false;
  }

  return true;
}

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

async function readPromotions(): Promise<Promotion[]> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(PROMOTIONS_FILE, "utf-8");
    const parsed = JSON.parse(data || "[]");
    return Array.isArray(parsed) ? parsed.map((promo) => ({
      ...promo,
      title: promo.title || promo.name || "Limited-Time Offer",
      name: promo.name || promo.title || "Limited-Time Offer",
      planPrices: normalizePlanPrices(promo.planPrices),
      applicablePlans: normalizePromotionPlanList(promo.applicablePlans || []),
    })) : [];
  } catch {
    return [];
  }
}

async function writePromotions(promotions: Promotion[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(PROMOTIONS_FILE, JSON.stringify(promotions, null, 2));
}

export async function getActivePromotion(): Promise<Promotion | null> {
  const promotions = await readPromotions();

  for (const promo of promotions) {
    if (!isPromotionActive(promo)) continue;
    return promo;
  }

  return null;
}

export async function getAllPromotions(): Promise<Promotion[]> {
  return readPromotions();
}

export async function getPromotionById(id: string): Promise<Promotion | null> {
  const promotions = await readPromotions();
  return promotions.find((p) => p.id === id) || null;
}

export async function createPromotion(data: Omit<Promotion, "id" | "createdAt" | "updatedAt">): Promise<Promotion> {
  const promotions = await readPromotions();
  const normalizedData = validatePromotionInput(data, "create");

  const newPromo: Promotion = {
    ...normalizedData,
    id: `promo-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  promotions.push(newPromo);
  await writePromotions(promotions);
  return newPromo;
}

export async function updatePromotion(id: string, data: Partial<Promotion>): Promise<Promotion | null> {
  const promotions = await readPromotions();
  const index = promotions.findIndex((p) => p.id === id);

  if (index === -1) {
    throw new Error(`Promotion ID ${id} does not exist.`);
  }

  const existing = promotions[index];
  const validated = validatePromotionInput({
    ...existing,
    ...data,
    id,
    name: data.name ?? data.title ?? existing.name ?? existing.title,
    title: data.title ?? data.name ?? existing.title ?? existing.name,
    applicablePlans: Array.isArray(data.applicablePlans) ? data.applicablePlans : existing.applicablePlans || [],
    planPrices: data.planPrices || existing.planPrices || getDefaultPlanPrices(),
    enabled: data.enabled ?? existing.enabled,
  }, "update");

  const updated: Promotion = {
    ...existing,
    ...validated,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  promotions[index] = updated;
  await writePromotions(promotions);
  return updated;
}

export async function deletePromotion(id: string): Promise<boolean> {
  const promotions = await readPromotions();
  const filtered = promotions.filter((p) => p.id !== id);

  if (filtered.length === promotions.length) return false;

  await writePromotions(filtered);
  return true;
}

export async function togglePromotionStatus(id: string): Promise<Promotion | null> {
  const promo = await getPromotionById(id);
  if (!promo) return null;

  return updatePromotion(id, { enabled: !promo.enabled });
}
