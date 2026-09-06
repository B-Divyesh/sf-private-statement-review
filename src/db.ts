import type { AppData } from "./types";

const REAL_DB_NAME = "private-statement-review";
const DEMO_DB_NAME = "private-statement-review-demo";
const STORE_NAME = "local-data";
const DATA_KEY = "app";

export type StorageMode = "real" | "demo";

export const emptyData = (): AppData => ({ version: 1, reviews: [], rules: [] });

function databaseName(mode: StorageMode): string {
  return mode === "demo" ? DEMO_DB_NAME : REAL_DB_NAME;
}

function openDb(mode: StorageMode): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName(mode), 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Local storage could not be opened."));
  });
}

export async function loadData(mode: StorageMode = "real"): Promise<AppData> {
  const db = await openDb(mode);
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(DATA_KEY);
    request.onsuccess = () => {
      db.close();
      resolve((request.result as AppData | undefined) ?? emptyData());
    };
    request.onerror = () => {
      db.close();
      reject(new Error("Saved reviews could not be read."));
    };
  });
}

export async function saveData(data: AppData, mode: StorageMode = "real"): Promise<void> {
  const db = await openDb(mode);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(data, DATA_KEY);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(new Error("Changes could not be saved on this device.")); };
  });
}

export async function clearData(mode: StorageMode = "real"): Promise<void> {
  const db = await openDb(mode);
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(DATA_KEY);
    request.onsuccess = () => { db.close(); resolve(); };
    request.onerror = () => { db.close(); reject(new Error("Saved reviews could not be cleared.")); };
  });
}

export async function discardDemoData(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DEMO_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Demo data could not be reset."));
    request.onblocked = () => reject(new Error("Close another demo tab, then reset the demo again."));
  });
}
