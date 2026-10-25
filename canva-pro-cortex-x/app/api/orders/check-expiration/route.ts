/**
 * API endpoint for manual expiration checking
 * Can be called by external cron services (e.g., Vercel Cron, GitHub Actions, etc.)
 *
 * GET /api/orders/check-expiration
 * Optional: ?token=YOUR_SECRET_TOKEN for authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAndNotifyExpiredOrders } from "@/lib/expiration-checker";

// Optional: Use a secret token for authentication
// Set EXPIRATION_CHECK_TOKEN in environment to enable
const EXPIRATION_CHECK_TOKEN = process.env.EXPIRATION_CHECK_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify either the configured query token or the Vercel Cron secret.
    if (EXPIRATION_CHECK_TOKEN || CRON_SECRET) {
      const token = request.nextUrl.searchParams.get("token");
      const authorization = request.headers.get("authorization");
      const validQueryToken = EXPIRATION_CHECK_TOKEN && token === EXPIRATION_CHECK_TOKEN;
      const validCronSecret = CRON_SECRET && authorization === `Bearer ${CRON_SECRET}`;
      if (!validQueryToken && !validCronSecret) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // Run expiration check
    const result = await checkAndNotifyExpiredOrders();

    // Return results
    return NextResponse.json({
      ok: result.success,
      message: result.message,
      ordersProcessed: result.ordersProcessed,
      ordersExpired: result.ordersExpired,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Expiration check endpoint error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to check expiration",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Vercel Cron configuration
 * Add this to vercel.json in the root of your project:
 *
 * {
 *   "crons": [{
 *     "path": "/api/orders/check-expiration",
 *     "schedule": "interval-5m"
 *   }]
 * }
 *
 * For cron syntax: Use "interval-5m" for every 5 minutes
 * Requires EXPIRATION_CHECK_TOKEN to be set for security.
 */
