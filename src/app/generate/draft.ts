"use client";

export type GenerationDraft = {
  presetId: string;
  sourceImage: File;
};

const DATABASE_NAME = "ai-photo-studio-drafts";
const STORE_NAME = "generation";
const DRAFT_KEY = "current";

function openDraftDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveGenerationDraft(draft: GenerationDraft) {
  const database = await openDraftDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(draft, DRAFT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadGenerationDraft() {
  const database = await openDraftDatabase();
  const draft = await new Promise<GenerationDraft | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(DRAFT_KEY);
    request.onsuccess = () => resolve((request.result as GenerationDraft | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return draft;
}
