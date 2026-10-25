/**
 * Server initialization component for Canva Pro app
 * Starts background services like expiration checker
 */

import { startExpirationChecker } from "@/lib/expiration-checker";

/**
 * InitializeApp - Call this in the root layout to initialize background services
 * This component doesn't render anything, just runs initialization code
 */
export function InitializeApp() {
  // Initialize expiration checker to run every 5 minutes
  // This will check for expired orders and send notifications
  if (process.env.NODE_ENV !== "test" && process.env.NEXT_PHASE !== "phase-production-build") {
    try {
      startExpirationChecker(5); // Check every 5 minutes
    } catch (error) {
      console.error("Failed to start expiration checker:", error);
      // Don't throw - allow app to continue even if background service fails
    }
  }

  return null;
}
