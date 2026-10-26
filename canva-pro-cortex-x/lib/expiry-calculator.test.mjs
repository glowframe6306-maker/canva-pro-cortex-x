import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateExpiry,
  formatDateInTimezone,
  formatTimeInTimezone,
  getDateTimeInTimezone,
  resolveApplicationTimezone,
} from "./expiry-calculator.ts";

test("valid timezones are accepted for order date and time formatting", () => {
  assert.equal(resolveApplicationTimezone("UTC"), "UTC");
  assert.equal(resolveApplicationTimezone("Asia/Colombo"), "Asia/Colombo");
  assert.doesNotThrow(() => getDateTimeInTimezone(new Date("2026-10-25T00:00:00.000Z"), "UTC"));
  assert.doesNotThrow(() => formatTimeInTimezone(new Date("2026-10-25T00:00:00.000Z"), "Asia/Colombo"));
});

test("invalid TZ values fall back safely for all order date formatting", () => {
  assert.equal(resolveApplicationTimezone("Invalid/Timezone"), "Asia/Colombo");
  assert.equal(formatDateInTimezone(new Date("2026-10-25T00:00:00.000Z"), "Invalid/Timezone"), "2026-10-25");
  assert.doesNotThrow(() => getDateTimeInTimezone(new Date("2026-10-25T00:00:00.000Z"), "Invalid/Timezone"));
  assert.doesNotThrow(() => calculateExpiry("WEEKLY", new Date("2026-10-25T00:00:00.000Z")));
});
