/**
 * Registry of every piece of browser storage RTSLR uses, and the single
 * "delete all my local data" routine (docs/SECURITY_PRIVACY.md §8).
 */
import { RECOGNITION_STORAGE_NAMES, deleteSampleDatabase, getSampleStore } from "@/features/recognition";
import { TRANSCRIPT_STORAGE_KEYS } from "@/features/language";
import { LEARNING_STORAGE_KEYS, progressStore } from "@/features/learning";

export const STUDIO_SETTINGS_KEY = "rtslr.studio.settings";
export const LOCALE_KEY = "rtslr.locale";

export const LOCAL_STORAGE_KEYS: readonly string[] = [
  STUDIO_SETTINGS_KEY,
  LOCALE_KEY,
  ...Object.values(TRANSCRIPT_STORAGE_KEYS),
  ...Object.values(LEARNING_STORAGE_KEYS),
  ...RECOGNITION_STORAGE_NAMES.localStorageKeys,
];

export const INDEXED_DB_NAMES: readonly string[] = [...RECOGNITION_STORAGE_NAMES.indexedDbDatabases];

export type DeleteReport = { localStorageKeys: number; databases: string[]; errors: string[] };

export async function deleteAllLocalData(): Promise<DeleteReport> {
  const report: DeleteReport = { localStorageKeys: 0, databases: [], errors: [] };
  try {
    await getSampleStore().clearAll();
  } catch (e) {
    report.errors.push(`samples: ${(e as Error).message}`);
  }
  try {
    progressStore.reset();
  } catch (e) {
    report.errors.push(`learning: ${(e as Error).message}`);
  }
  for (const key of LOCAL_STORAGE_KEYS) {
    try {
      if (window.localStorage.getItem(key) !== null) report.localStorageKeys++;
      window.localStorage.removeItem(key);
    } catch (e) {
      report.errors.push(`${key}: ${(e as Error).message}`);
    }
  }
  try {
    const result = await deleteSampleDatabase();
    if (result === "deleted") report.databases.push(...INDEXED_DB_NAMES);
    else if (result === "blocked") report.errors.push("sample database is open in another tab");
  } catch (e) {
    report.errors.push(`database: ${(e as Error).message}`);
  }
  return report;
}
