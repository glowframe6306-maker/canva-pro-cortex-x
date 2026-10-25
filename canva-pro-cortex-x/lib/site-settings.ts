import fs from "node:fs/promises";
import path from "node:path";

export type FeaturedPlanSettings = {
  featuredPlanId: string;
  featuredPlanEnabled: boolean;
  featuredBadgeText: string;
};

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
  enabled: boolean;
  order: number;
};

export type PromoCodeType = "percentage" | "fixed";

export type PromoCodeUsage = {
  id: string;
  orderId?: string;
  planId: string;
  discountPercentage: number;
  discountAmount: number;
  finalAmount: number;
  usedAt: string;
};

export type PromoCode = {
  id: string;
  code: string;
  name: string;
  type?: PromoCodeType;
  value?: number;
  discountPercentage?: number;
  applicablePlans: string[];
  startDate?: string;
  startTime?: string;
  expiryDate?: string;
  expiryTime?: string;
  usageLimit?: number;
  usedCount: number;
  totalDiscountGiven?: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  usageHistory?: PromoCodeUsage[];
};

export type AnnouncementSettings = {
  enabled: boolean;
  message: string;
  buttonText: string;
  buttonAction: string;
};

export type SiteSettings = FeaturedPlanSettings & {
  faqs: FAQItem[];
  promoCodes: PromoCode[];
  announcement: AnnouncementSettings;
  discountStacking: boolean;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const SETTINGS_FILE = path.join(DATA_DIR, "site-settings.json");

const defaultFAQ: FAQItem[] = [
  {
    id: "faq-canva",
    question: "What is Canva?",
    answer: "Canva is an online visual design and content creation platform that helps users create social media posts, presentations, marketing materials, and creative content with easy-to-use tools.",
    enabled: true,
    order: 1,
  },
  {
    id: "faq-order",
    question: "How do I place an order?",
    answer: "Choose a plan, complete the order form, upload your payment slip if required, and submit the request. Our team will review the order and respond with the next steps.",
    enabled: true,
    order: 2,
  },
  {
    id: "faq-payment",
    question: "How does payment work?",
    answer: "Payment is completed using the bank account details shared on the website. After sending the payment, you upload the receipt and include the payment reference so our team can verify the payment.",
    enabled: true,
    order: 3,
  },
  {
    id: "faq-processing",
    question: "When will my order be processed?",
    answer: "Processing time depends on the service and order workflow managed by the website administrator. Once the payment is verified or the request is approved, the order moves forward according to the site workflow.",
    enabled: true,
    order: 4,
  },
  {
    id: "faq-tracking",
    question: "How can I check my order?",
    answer: "Use the Order Tracking feature available on the website. Enter your order ID or reference number to view the latest status, selected plan, and update time.",
    enabled: true,
    order: 5,
  },
  {
    id: "faq-support",
    question: "How can I contact support?",
    answer: "You can contact support through the customer service form on the website, WhatsApp, or the configured support contact details listed on the site.",
    enabled: true,
    order: 6,
  },
  {
    id: "faq-expiry",
    question: "What happens when my plan expires?",
    answer: "Your access depends on the specific plan purchased and the service terms configured by the administrator. Once expired, the service may require renewal or reactivation according to the plan conditions.",
    enabled: true,
    order: 7,
  },
  {
    id: "faq-change-plan",
    question: "Can I change my plan?",
    answer: "Plan changes are subject to the policy configured by the administrator. If you need a different plan, contact support and the team will guide you through the available options.",
    enabled: true,
    order: 8,
  },
];

export const defaultSiteSettings: SiteSettings = {
  featuredPlanId: "monthly",
  featuredPlanEnabled: true,
  featuredBadgeText: "MOST POPULAR",
  faqs: defaultFAQ,
  promoCodes: [],
  announcement: {
    enabled: true,
    message: "Special offers and new plans are now available.",
    buttonText: "VIEW PLANS",
    buttonAction: "scroll-to-plans",
  },
  discountStacking: false,
};

async function ensureSettingsFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SETTINGS_FILE);
  } catch {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(defaultSiteSettings, null, 2), "utf8");
  }
}

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    await ensureSettingsFile();
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      ...defaultSiteSettings,
      ...parsed,
      announcement: { ...defaultSiteSettings.announcement, ...(parsed.announcement || {}) },
      faqs: Array.isArray(parsed.faqs) && parsed.faqs.length ? parsed.faqs : defaultSiteSettings.faqs,
      promoCodes: Array.isArray(parsed.promoCodes) ? parsed.promoCodes : [],
      featuredPlanId: String(parsed.featuredPlanId || defaultSiteSettings.featuredPlanId),
      featuredPlanEnabled: parsed.featuredPlanEnabled !== false,
      featuredBadgeText: String(parsed.featuredBadgeText || defaultSiteSettings.featuredBadgeText),
      discountStacking: parsed.discountStacking === true,
    };
  } catch (error) {
    console.error("Failed to read site settings:", error);
    return defaultSiteSettings;
  }
}

export async function saveSiteSettings(settings: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSiteSettings();
  const merged = {
    ...current,
    ...settings,
    announcement: { ...current.announcement, ...(settings.announcement || {}) },
    faqs: settings.faqs || current.faqs,
    promoCodes: settings.promoCodes || current.promoCodes,
    discountStacking: settings.discountStacking ?? current.discountStacking ?? false,
  };

  for (const promo of merged.promoCodes) {
    const error = validatePromoCodeEntry(promo, merged.promoCodes);
    if (error) {
      throw new Error(error);
    }
    promo.code = normalizePromoCode(promo.code || "");
    promo.name = String(promo.name || "").trim();
    promo.discountPercentage = Number(promo.discountPercentage ?? promo.value ?? 0);
    promo.value = Number(promo.discountPercentage ?? promo.value ?? 0);
    promo.type = "percentage";
    promo.applicablePlans = Array.from(new Set((promo.applicablePlans || []).map((plan) => String(plan).trim().toLowerCase())));
    promo.usageLimit = Number(promo.usageLimit ?? 0);
    promo.usedCount = Number(promo.usedCount || 0);
    promo.updatedAt = new Date().toISOString();
  }

  await ensureSettingsFile();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

export function normalizePromoCode(code: string) {
  return String(code || "").trim().replace(/\s+/g, "").toUpperCase();
}

export function validatePromoCodeEntry(promo: Partial<PromoCode>, allPromos: PromoCode[] = []) {
  const code = normalizePromoCode(String(promo.code || ""));
  const name = String(promo.name || "").trim();
  const discountPercentage = Number(promo.discountPercentage ?? promo.value ?? 0);
  const applicablePlans = Array.isArray(promo.applicablePlans) ? promo.applicablePlans : [];
  const usageLimit = Number(promo.usageLimit ?? 0);

  if (!code) return "Promo Code is required.";
  if (!name) return "Promo Name is required.";
  if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) return "Discount percentage must be between 0 and 100.";
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
      if (!Number.isNaN(startAt.getTime()) && expiryAt <= startAt) return "Expiry must be after the start time.";
    }
  }

  if (usageLimit < 0) return "Usage limit cannot be negative.";

  const duplicate = allPromos.some((candidate) => candidate.id !== promo.id && normalizePromoCode(candidate.code) === code);
  if (duplicate) return "Promo Code must be unique.";

  return null;
}

function normalizePlanId(planId: string) {
  return String(planId || "").trim().toLowerCase();
}

function isWithinScheduledWindow(promo: PromoCode, now = new Date()) {
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

export function getPromoCodeDiscountAmount(originalPrice: number, discountPercentage: number) {
  const basePrice = Number(originalPrice) || 0;
  const percentage = Number.isFinite(discountPercentage) ? Math.max(0, Math.min(Number(discountPercentage), 100)) : 0;
  return Math.min(basePrice, Math.round((basePrice * percentage) / 100));
}

export async function validatePromoCodeForPlan(code: string, planId: string, originalPrice: number): Promise<{ valid: boolean; discount: number; finalPrice: number; message: string; promo?: PromoCode }> {
  const settings = await getSiteSettings();
  const normalized = normalizePromoCode(code);
  const normalizedPlan = normalizePlanId(planId);

  if (!normalized) {
    return { valid: false, discount: 0, finalPrice: originalPrice, message: "Please enter a promo code." };
  }

  const promo = settings.promoCodes.find((item) => normalizePromoCode(item.code) === normalized);
  if (!promo) {
    return { valid: false, discount: 0, finalPrice: originalPrice, message: "Invalid or expired promo code." };
  }

  if (!promo.enabled) {
    return { valid: false, discount: 0, finalPrice: originalPrice, message: "This promo code is currently disabled." };
  }

  if (!isWithinScheduledWindow(promo)) {
    return { valid: false, discount: 0, finalPrice: originalPrice, message: "This promo code is not active yet or has expired." };
  }

  const planList = (promo.applicablePlans || []).map((item) => normalizePlanId(item));
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

export async function incrementPromoUsage(code: string, orderId?: string, planId?: string, originalPrice?: number): Promise<void> {
  const settings = await getSiteSettings();
  const normalized = normalizePromoCode(code);
  const promoIndex = settings.promoCodes.findIndex((item) => normalizePromoCode(item.code) === normalized);
  if (promoIndex < 0) return;

  const promo = settings.promoCodes[promoIndex];
  const nextUsedCount = (promo.usedCount || 0) + 1;
  const discountPercentage = Number(promo.discountPercentage ?? promo.value ?? 0);
  const discountAmount = getPromoCodeDiscountAmount(Number(originalPrice || 0), discountPercentage);
  const finalAmount = Math.max(0, Number(originalPrice || 0) - discountAmount);

  settings.promoCodes[promoIndex] = {
    ...promo,
    usedCount: nextUsedCount,
    totalDiscountGiven: Number(promo.totalDiscountGiven || 0) + discountAmount,
    enabled: promo.usageLimit && promo.usageLimit > 0 ? nextUsedCount < promo.usageLimit : promo.enabled,
    updatedAt: new Date().toISOString(),
    usageHistory: [
      ...(promo.usageHistory || []),
      {
        id: `usage-${Date.now()}`,
        orderId,
        planId: String(planId || ""),
        discountPercentage,
        discountAmount,
        finalAmount,
        usedAt: new Date().toISOString(),
      },
    ],
  };

  await saveSiteSettings({ promoCodes: settings.promoCodes });
}
