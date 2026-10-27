import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createApplicationSettingsStore,
  InvalidApplicationSettingError,
  loadApplicationSetting,
  MissingApplicationSettingError,
  requireApplicationSetting,
} from "./application-settings-values.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("required settings fail explicitly instead of silently using defaults", () => {
  for (const key of ["site-settings", "promotions"]) {
    assert.throws(
      () => requireApplicationSetting([], key),
      (error) => error instanceof MissingApplicationSettingError
        && error.message === `Required application setting "${key}" is not configured.`,
    );
  }
  assert.deepEqual(
    requireApplicationSetting([{ setting_value: { discountStacking: true } }], "site-settings"),
    { discountStacking: true },
  );
  assert.equal(new InvalidApplicationSettingError("promotions").name, "InvalidApplicationSettingError");
});

test("database read failures propagate instead of returning order-pricing defaults", async () => {
  await assert.rejects(
    loadApplicationSetting("promotions", async () => {
      throw new Error("synthetic PostgreSQL read failure");
    }),
    /synthetic PostgreSQL read failure/,
  );
});

test("PostgreSQL settings store reads and upserts JSON values by setting key", async () => {
  const calls = [];
  const values = new Map();
  const store = createApplicationSettingsStore(async (statement, parameters) => {
    calls.push({ statement, parameters });
    if (statement.startsWith("SELECT")) {
      return values.has(parameters[0])
        ? [{ setting_value: values.get(parameters[0]) }]
        : [];
    }
    values.set(parameters[0], JSON.parse(parameters[1]));
    return [];
  });

  const settings = {
    featuredPlanId: "yearly",
    discountStacking: true,
    promoCodes: [{ code: "KEEP-ME", usedCount: 3 }],
  };
  await store.save("site-settings", settings);
  assert.deepEqual(await store.get("site-settings"), settings);
  assert.match(calls[0].statement, /ON CONFLICT \(setting_key\) DO UPDATE/);
  assert.deepEqual(calls[0].parameters, ["site-settings", JSON.stringify(settings)]);
  assert.match(calls[1].statement, /WHERE setting_key = \$1 LIMIT 1/);
  assert.deepEqual(calls[1].parameters, ["site-settings"]);

  const promotions = [{
    id: "synthetic-promotion",
    name: "Test offer",
    enabled: true,
    planPrices: { monthly: { promotionalPrice: 400 } },
  }];
  await store.save("promotions", promotions);
  assert.deepEqual(await store.get("promotions"), promotions);
  await store.save("promotions", []);
  assert.deepEqual(await store.get("promotions"), []);
});

test("PostgreSQL settings store propagates storage write failures", async () => {
  const store = createApplicationSettingsStore(async () => {
    throw new Error("synthetic PostgreSQL write failure");
  });
  await assert.rejects(
    store.save("promotions", []),
    /synthetic PostgreSQL write failure/,
  );
});

test("configuration import inserts only missing values and is repeatable", async () => {
  const values = new Map([["site-settings", { discountStacking: true }]]);
  const store = createApplicationSettingsStore(async (statement, parameters) => {
    if (statement.startsWith("INSERT") && statement.includes("ON CONFLICT (setting_key) DO NOTHING")) {
      const inserted = [];
      for (let index = 0; index < parameters.length; index += 2) {
        const key = parameters[index];
        if (!values.has(key)) {
          values.set(key, JSON.parse(parameters[index + 1]));
          inserted.push({ setting_key: key });
        }
      }
      return inserted;
    }
    if (statement.startsWith("SELECT")) {
      return values.has(parameters[0])
        ? [{ setting_value: values.get(parameters[0]) }]
        : [];
    }
    throw new Error("Unexpected application settings query.");
  });
  const importedSettings = { discountStacking: false };
  const importedPromotions = [{ id: "preserved-promotion-candidate" }];

  assert.deepEqual(
    await store.importIfMissing({
      "site-settings": importedSettings,
      promotions: importedPromotions,
    }),
    { inserted: ["promotions"], preserved: ["site-settings"] },
  );
  assert.deepEqual(await store.get("site-settings"), { discountStacking: true });
  assert.deepEqual(await store.get("promotions"), importedPromotions);
  assert.deepEqual(
    await store.importIfMissing({
      "site-settings": importedSettings,
      promotions: importedPromotions,
    }),
    { inserted: [], preserved: ["site-settings", "promotions"] },
  );
});

test("configuration import rejects a missing database result", async () => {
  const store = createApplicationSettingsStore(async () => undefined);

  await assert.rejects(
    store.importIfMissing({ "site-settings": {}, promotions: [] }),
    /did not return its inserted keys/,
  );
});

test("configuration import rejects values that cannot be serialized as JSON", async () => {
  const store = createApplicationSettingsStore(async () => []);
  await assert.rejects(
    store.importIfMissing({ "site-settings": undefined, promotions: [] }),
    /cannot be serialized as JSON/,
  );
});

test("settings and promotions use PostgreSQL persistence rather than the deployment filesystem", async () => {
  const [settings, promotions, storage, storageAdapter, migration, previousMigration, settingsRoute, adminPromotionsRoute] = await Promise.all([
    readFile(path.join(root, "lib", "site-settings.ts"), "utf8"),
    readFile(path.join(root, "lib", "promotion-database.ts"), "utf8"),
    readFile(path.join(root, "lib", "application-settings-values.ts"), "utf8"),
    readFile(path.join(root, "lib", "application-settings-store.ts"), "utf8"),
    readFile(path.join(root, "db", "migrations", "002_application_settings.sql"), "utf8"),
    readFile(path.join(root, "db", "migrations", "001_order_storage.sql"), "utf8"),
    readFile(path.join(root, "app", "api", "site-settings", "route.ts"), "utf8"),
    readFile(path.join(root, "app", "api", "admin", "promotions", "route.ts"), "utf8"),
  ]);

  assert.doesNotMatch(settings, /node:fs\/promises|\.data(?:[\\/]|$)|mkdir\(/);
  assert.doesNotMatch(promotions, /node:fs\/promises|\.data(?:[\\/]|$)|mkdir\(/);
  assert.match(settings, /getApplicationSetting<unknown>\("site-settings"\)/);
  assert.match(promotions, /getApplicationSetting<unknown>\("promotions"\)/);
  assert.match(storage, /FROM application_settings/);
  assert.match(storage, /ON CONFLICT \(setting_key\) DO UPDATE/);
  assert.match(storageAdapter, /getPostgresClient\(\)\.query\(statement, parameters\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS application_settings/);
  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.match(migration, /setting_value jsonb NOT NULL/);
  assert.match(migration, /setting_key text PRIMARY KEY/);
  assert.match(migration, /updated_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(migration, /v_updated_at_default IS DISTINCT FROM 'now\(\)'/);
  assert.match(migration, /c\.contype <> 'n'/);
  assert.doesNotMatch(migration, /INSERT INTO application_settings/);
  assert.doesNotMatch(previousMigration, /application_settings/);
  assert.doesNotMatch(settings, /MissingApplicationSettingError/);
  assert.doesNotMatch(promotions, /MissingApplicationSettingError/);
  assert.match(settingsRoute, /Site settings have not been migrated/);
  assert.match(settingsRoute, /status: 503/);
  assert.match(adminPromotionsRoute, /Promotions have not been migrated/);
  assert.match(adminPromotionsRoute, /status: 503/);
  assert.match(adminPromotionsRoute, /getAllPromotions\(\)/);
  assert.match(adminPromotionsRoute, /createPromotion\(body\)/);
  assert.match(adminPromotionsRoute, /updatePromotion\(id, body\)/);
  assert.match(adminPromotionsRoute, /deletePromotion\(id\)/);
  assert.match(settings, /saveApplicationSetting\("site-settings", merged\)/);
  assert.match(promotions, /saveApplicationSetting\("promotions", promotions\)/);
  assert.match(promotions, /async function updatePromotion/);
  assert.match(promotions, /async function deletePromotion/);
});

test("active promotion API reports storage failures instead of a success-shaped empty result", async () => {
  const activePromotionRoute = await readFile(
    path.join(root, "app", "api", "promotions", "active", "route.ts"),
    "utf8",
  );

  assert.match(activePromotionRoute, /Unable to fetch active promotion/);
  assert.match(activePromotionRoute, /status: 500/);
  assert.doesNotMatch(activePromotionRoute, /ok: true,\s*promotion: null/);
});

test("settings and promotions admin views surface missing-setting load failures", async () => {
  const [adminPage, promotionsManagement] = await Promise.all([
    readFile(path.join(root, "app", "admin", "page.tsx"), "utf8"),
    readFile(path.join(root, "components", "promotions-management.tsx"), "utf8"),
  ]);

  assert.match(adminPage, /!response\.ok \|\| !result\.ok \|\| !result\.settings/);
  assert.match(adminPage, /siteSettingsError/);
  assert.match(adminPage, /role="alert"/);
  assert.match(adminPage, /Retry loading settings/);
  assert.match(promotionsManagement, /!response\.ok \|\| !data\.ok \|\| !Array\.isArray\(data\.promotions\)/);
  assert.match(promotionsManagement, /loadError/);
  assert.match(promotionsManagement, /<AdminButton variant="outline" size="sm" onClick=\{fetchPromotions\}>Retry/);
  assert.match(promotionsManagement, /disabled=\{Boolean\(loadError\)\}/);
  assert.match(promotionsManagement, /loadError \? null : promotions\.length === 0/);
});

test("promo validation reports invalid requests and missing settings with explicit HTTP errors", async () => {
  const [route, requestValidator] = await Promise.all([
    readFile(path.join(root, "app", "api", "site-settings", "promo", "route.ts"), "utf8"),
    readFile(path.join(root, "lib", "promo-validation-request.ts"), "utf8"),
  ]);

  assert.match(route, /isPromoValidationRequest\(body\)/);
  assert.match(route, /status: 400/);
  assert.match(route, /MissingApplicationSettingError/);
  assert.match(route, /status: 503/);
  assert.match(route, /status: 500/);
  assert.doesNotMatch(route, /finalPrice: Number\(0\)|Invalid or expired promo code/);
  assert.match(requestValidator, /Number\.isFinite\(request\.originalPrice\)/);
  assert.match(requestValidator, /request\.originalPrice >= 0/);
});
