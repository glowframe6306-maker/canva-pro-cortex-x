export type ApplicationSettingKey = "site-settings" | "promotions";
export type ApplicationSettingsQuery = (
  statement: string,
  parameters: string[],
) => Promise<Array<{ setting_key?: string; setting_value?: unknown }> | undefined>;

export class MissingApplicationSettingError extends Error {
  constructor(key: ApplicationSettingKey) {
    super(`Required application setting "${key}" is not configured.`);
    this.name = "MissingApplicationSettingError";
  }
}

export class InvalidApplicationSettingError extends Error {
  constructor(key: ApplicationSettingKey) {
    super(`Stored application setting "${key}" is invalid.`);
    this.name = "InvalidApplicationSettingError";
  }
}

export function requireApplicationSetting<T>(
  rows: Array<{ setting_value: T }> | undefined,
  key: ApplicationSettingKey,
): T {
  const row = rows?.[0];
  if (!row) throw new MissingApplicationSettingError(key);
  return row.setting_value;
}

export async function loadApplicationSetting<T>(
  key: ApplicationSettingKey,
  readRows: (settingKey: ApplicationSettingKey) => Promise<Array<{ setting_value: T }> | undefined>,
): Promise<T> {
  return requireApplicationSetting(await readRows(key), key);
}

export function createApplicationSettingsStore(query: ApplicationSettingsQuery) {
  return {
    async get<T>(key: ApplicationSettingKey): Promise<T> {
      return loadApplicationSetting(key, async (settingKey) => await query(
        "SELECT setting_value FROM application_settings WHERE setting_key = $1 LIMIT 1",
        [settingKey],
      ) as Array<{ setting_value: T }> | undefined);
    },

    async save<T>(key: ApplicationSettingKey, value: T): Promise<void> {
      await query(
        `INSERT INTO application_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (setting_key) DO UPDATE
           SET setting_value = EXCLUDED.setting_value,
               updated_at = EXCLUDED.updated_at`,
        [key, JSON.stringify(value)],
      );
    },

    async importIfMissing(values: Record<ApplicationSettingKey, unknown>) {
      const keys: ApplicationSettingKey[] = ["site-settings", "promotions"];
      const parameters = keys.flatMap((key) => {
        const serialized = JSON.stringify(values[key]);
        if (serialized === undefined) {
          throw new TypeError(`Application setting "${key}" cannot be serialized as JSON.`);
        }
        return [key, serialized];
      });
      const insertedRows = await query(
        `INSERT INTO application_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2::jsonb, now()), ($3, $4::jsonb, now())
         ON CONFLICT (setting_key) DO NOTHING
         RETURNING setting_key`,
        parameters,
      );
      if (!insertedRows) {
        throw new Error("Application settings import did not return its inserted keys.");
      }
      const insertedKeys = new Set(insertedRows.flatMap((row) =>
        row.setting_key === "site-settings" || row.setting_key === "promotions"
          ? [row.setting_key]
          : [],
      ));

      return {
        inserted: keys.filter((key) => insertedKeys.has(key)),
        preserved: keys.filter((key) => !insertedKeys.has(key)),
      };
    },
  };
}
