/**
 * Plan expiry calculation and timezone utilities
 * Handles plan duration calculations and date/time formatting
 */

export type PlanType = "FREE_TRIAL" | "WEEKLY" | "MONTHLY" | "YEARLY" | "LIFETIME";

export type ExpiryCalculation = {
  activatedAt: string; // ISO timestamp when access was activated
  activationDate: string; // YYYY-MM-DD
  activationTime: string; // HH:mm:ss
  expiryAt: string; // ISO timestamp of expiry
  expiryDate: string; // YYYY-MM-DD
  expiryTime: string; // HH:mm:ss
  durationDays: number;
};

const APP_TIMEZONE = process.env.TZ || "Asia/Colombo";

const PLAN_DURATIONS: Record<PlanType, number> = {
  FREE_TRIAL: 3,
  WEEKLY: 7,
  MONTHLY: 30,
  YEARLY: 365,
  LIFETIME: 0,
};

/**
 * Format a Date object to YYYY-MM-DD using the app timezone
 */
export function formatDateInTimezone(date: Date, timezone = APP_TIMEZONE): string {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(date);
  return formatted;
}

/**
 * Format a Date object to HH:mm:ss using the app timezone
 */
export function formatTimeInTimezone(date: Date, timezone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

/**
 * Get both date and time formatted strings for a Date object
 */
export function getDateTimeInTimezone(
  date = new Date(),
  timezone = APP_TIMEZONE
): { date: string; time: string } {
  return {
    date: formatDateInTimezone(date, timezone),
    time: formatTimeInTimezone(date, timezone),
  };
}

/**
 * Calculate plan expiry based on plan type and activation date/time
 * For LIFETIME plans, no expiry is calculated
 */
export function calculateExpiry(
  planType: PlanType,
  activationDateTime: Date = new Date()
): ExpiryCalculation | null {
  if (planType === "LIFETIME") {
    const { date: activationDate, time: activationTime } = getDateTimeInTimezone(activationDateTime);
    return {
      activatedAt: activationDateTime.toISOString(),
      activationDate,
      activationTime,
      expiryAt: "",
      expiryDate: "NEVER",
      expiryTime: "NEVER",
      durationDays: 0,
    };
  }

  const durationDays = PLAN_DURATIONS[planType];
  if (!durationDays) {
    return null;
  }

  const expiryDate = new Date(activationDateTime.getTime() + (durationDays * 24 * 60 * 60 * 1000));
  const { date: activationDate, time: activationTime } = getDateTimeInTimezone(activationDateTime);
  const { date: expiryDateFormatted, time: expiryTime } = getDateTimeInTimezone(expiryDate);

  return {
    activatedAt: activationDateTime.toISOString(),
    activationDate,
    activationTime,
    expiryAt: expiryDate.toISOString(),
    expiryDate: expiryDateFormatted,
    expiryTime,
    durationDays,
  };
}

/**
 * Get the display duration string for a plan
 */
export function getPlanDurationDisplay(planType: PlanType | string): string {
  const normalizedPlan = typeof planType === "string" ? planNameToPlanType(planType) : planType;
  const durations: Record<PlanType, string> = {
    FREE_TRIAL: "3 Days",
    WEEKLY: "7 Days",
    MONTHLY: "1 Month",
    YEARLY: "1 Year",
    LIFETIME: "Lifetime",
  };
  return normalizedPlan ? durations[normalizedPlan] : "N/A";
}

/**
 * Check if a plan has expired based on its expiryAt timestamp
 */
export function hasExpired(expiryAtISO: string, now: Date = new Date()): boolean {
  if (!expiryAtISO) {
    return false; // No expiry date means it's not expired (e.g., LIFETIME)
  }
  try {
    const expiryDate = new Date(expiryAtISO);
    return now >= expiryDate;
  } catch {
    return false;
  }
}

/**
 * Get remaining time in days until expiry
 * Returns negative number if already expired
 */
export function getDaysUntilExpiry(expiryAtISO: string, now: Date = new Date()): number {
  if (!expiryAtISO) {
    return Infinity; // LIFETIME or no expiry
  }
  try {
    const expiryDate = new Date(expiryAtISO);
    const diff = expiryDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

/**
 * Map friendly plan names to internal plan types
 */
export function planNameToPlanType(planName: string): PlanType | null {
  const nameMap: Record<string, PlanType> = {
    FREE_TRIAL: "FREE_TRIAL",
    "3 DAYS FREE TRIAL": "FREE_TRIAL",
    WEEKLY: "WEEKLY",
    MONTHLY: "MONTHLY",
    ANNUALLY: "YEARLY",
    YEARLY: "YEARLY",
    LIFETIME: "LIFETIME",
  };
  return nameMap[planName.toUpperCase()] || null;
}
