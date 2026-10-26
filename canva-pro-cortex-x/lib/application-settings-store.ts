import { getPostgresClient } from "@/lib/postgres";
import { createApplicationSettingsStore } from "@/lib/application-settings-values";

const postgresSettingsStore = createApplicationSettingsStore(async (statement, parameters) =>
  await getPostgresClient().query(statement, parameters) as Array<{ setting_key?: string; setting_value?: unknown }> | undefined);

export const getApplicationSetting = postgresSettingsStore.get;
export const saveApplicationSetting = postgresSettingsStore.save;
export const importApplicationSettingsIfMissing = postgresSettingsStore.importIfMissing;
