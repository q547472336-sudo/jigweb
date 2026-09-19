import type { PuzzleSnapshot } from "./types";

const DB_NAME = "jigsaw-time";
const STORE = "puzzle-snapshots";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "puzzleId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readSnapshot(puzzleId: string): Promise<PuzzleSnapshot | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(puzzleId);
    request.onsuccess = () => resolve(request.result as PuzzleSnapshot | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function writeSnapshot(snapshot: PuzzleSnapshot): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(snapshot);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
