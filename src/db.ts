import type { AppData } from "./types";

const DB_NAME = "private-statement-review";
const STORE_NAME = "local-data";
const DATA_KEY = "app";

export const emptyData = (): AppData => ({ version: 1, reviews: [], rules: [] });

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Local storage could not be opened."));
  });
}

export async function loadData(): Promise<AppData> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(DATA_KEY);
    request.onsuccess = () => resolve((request.result as AppData | undefined) ?? emptyData());
    request.onerror = () => reject(new Error("Saved reviews could not be read."));
  });
}

export async function saveData(data: AppData): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(data, DATA_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error("Changes could not be saved on this device."));
  });
}

export async function clearData(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(DATA_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Saved reviews could not be cleared."));
  });
}
