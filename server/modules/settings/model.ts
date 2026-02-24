/**
 * Settings module: re-export shared schema only (no new table definitions).
 */
export type { AppSettings, InsertAppSettings } from "@shared/schema";
export { insertAppSettingsSchema } from "@shared/schema";
