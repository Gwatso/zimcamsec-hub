"use client";

/**
 * "Save for offline" library, stored in the Cache API (binary PDFs) with a
 * small metadata index in localStorage. Deliberately explicit (user-chosen)
 * rather than caching every opened PDF: phones in the target market often
 * have 16–32 GB of storage and expensive data, so we never silently fill them.
 */
export const DOCS_CACHE = "zch-docs-v1";
const INDEX_KEY = "zch-offline-index-v1";
const CHANGE_EVENT = "zch-offline-change";

export interface OfflineDoc {
  id: string;
  slug: string;
  title: string;
  sizeBytes: number;
  pageCount: number;
  audience: "public" | "educator";
  savedAt: number;
}

export function offlineUrl(id: string): string {
  return `/api/resources/${id}/file?mode=download`;
}

export function isOfflineSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window && window.isSecureContext;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // Private mode / blocked storage.
  }
}

export function listOfflineDocs(): OfflineDoc[] {
  const raw = safeStorage()?.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OfflineDoc[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch {
    return [];
  }
}

function writeIndex(docs: OfflineDoc[]) {
  safeStorage()?.setItem(INDEX_KEY, JSON.stringify(docs));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onOfflineDocsChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export class OfflineSaveError extends Error {}

export async function saveOffline(doc: Omit<OfflineDoc, "savedAt">): Promise<void> {
  if (!isOfflineSupported()) throw new OfflineSaveError("Offline saving isn't supported in this browser.");

  if (navigator.storage?.estimate) {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    if (quota > 0 && quota - usage < doc.sizeBytes * 1.2) {
      throw new OfflineSaveError("Not enough free storage on this device. Remove some saved documents first.");
    }
  }

  const response = await fetch(offlineUrl(doc.id), { credentials: "same-origin" });
  if (response.status === 401) throw new OfflineSaveError("Please sign in again to save this document.");
  if (!response.ok) throw new OfflineSaveError("Download failed. Check your connection and try again.");

  const cache = await caches.open(DOCS_CACHE);
  await cache.put(offlineUrl(doc.id), response);
  // Ask the browser not to evict our saved documents under storage pressure.
  navigator.storage?.persist?.().catch(() => undefined);

  const others = listOfflineDocs().filter((d) => d.id !== doc.id);
  writeIndex([{ ...doc, savedAt: Date.now() }, ...others]);
}

export async function removeOffline(id: string): Promise<void> {
  if (isOfflineSupported()) {
    const cache = await caches.open(DOCS_CACHE);
    await cache.delete(offlineUrl(id));
  }
  writeIndex(listOfflineDocs().filter((d) => d.id !== id));
}

export async function getOfflineBytes(id: string): Promise<Uint8Array | null> {
  if (!isOfflineSupported()) return null;
  const match = await caches.match(offlineUrl(id), { cacheName: DOCS_CACHE });
  return match ? new Uint8Array(await match.arrayBuffer()) : null;
}

/**
 * On sign-out: remove educator-only documents (shared family/school devices
 * are common) and ask the service worker to drop cached pages that may show
 * the previous user's name.
 */
export async function clearPrivateOfflineData(): Promise<void> {
  const educatorDocs = listOfflineDocs().filter((d) => d.audience === "educator");
  await Promise.allSettled(educatorDocs.map((d) => removeOffline(d.id)));
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PAGE_CACHE" });
}
