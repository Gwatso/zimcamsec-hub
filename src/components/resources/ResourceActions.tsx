"use client";

import { Check, CloudDownload, Download, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { refreshSoon } from "@/lib/client/live-counts";
import {
  OfflineSaveError,
  isOfflineSupported,
  listOfflineDocs,
  onOfflineDocsChange,
  removeOffline,
  saveOffline,
  type OfflineDoc,
} from "@/lib/client/offline-docs";
import { formatBytes } from "@/lib/format";

export function DownloadButton({ id, slug, sizeBytes }: { id: string; slug: string; sizeBytes: number }) {
  return (
    <a
      href={`/api/resources/${id}/file?mode=download`}
      download={`${slug}.pdf`}
      className="btn-primary"
      onClick={() => refreshSoon(id, 2000)}
    >
      <Download aria-hidden className="size-4" /> Download PDF <span className="font-normal opacity-80">({formatBytes(sizeBytes)})</span>
    </a>
  );
}

function useIsSaved(id: string): boolean {
  return useSyncExternalStore(
    onOfflineDocsChange,
    () => listOfflineDocs().some((d) => d.id === id),
    () => false,
  );
}

export function SaveOfflineButton({ doc }: { doc: Omit<OfflineDoc, "savedAt"> }) {
  const saved = useIsSaved(doc.id);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSupported(isOfflineSupported()), []);
  if (!supported) return null;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (saved) await removeOffline(doc.id);
      else {
        await saveOffline(doc);
        refreshSoon(doc.id);
      }
    } catch (err) {
      setError(err instanceof OfflineSaveError ? err.message : "Couldn't save this document. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={toggle} disabled={busy} className="btn-secondary" aria-pressed={saved}>
        {busy ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : saved ? (
          <Check aria-hidden className="size-4 text-heritage-600" />
        ) : (
          <CloudDownload aria-hidden className="size-4" />
        )}
        {saved ? "Saved offline" : "Save for offline"}
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Lists documents stored on this device; usable fully offline. */
export function OfflineLibrary({ emptyHint }: { emptyHint?: React.ReactNode }) {
  const docs = useSyncExternalStore(onOfflineDocsChange, listOfflineDocsCached, () => EMPTY);
  const total = docs.reduce((sum, d) => sum + d.sizeBytes, 0);

  if (docs.length === 0) {
    return <div className="card p-6 text-sm text-stone-600 dark:text-stone-400">{emptyHint ?? "No documents saved on this device yet."}</div>;
  }

  return (
    <div>
      <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
        {docs.length} saved · {formatBytes(total)} on this device
      </p>
      <ul className="space-y-2">
        {docs.map((d) => (
          <li key={d.id} className="card flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <a href={`/offline?open=${d.id}`} className="font-medium hover:underline">
                {d.title}
              </a>
              <p className="text-xs text-stone-500">
                {formatBytes(d.sizeBytes)} · {d.pageCount} pages
              </p>
            </div>
            <button type="button" onClick={() => void removeOffline(d.id)} className="btn-ghost min-h-9 px-2.5" aria-label={`Remove ${d.title} from this device`}>
              <Trash2 aria-hidden className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// useSyncExternalStore needs a stable snapshot between changes.
const EMPTY: OfflineDoc[] = [];
let snapshot: OfflineDoc[] = EMPTY;
let snapshotKey = "";
function listOfflineDocsCached(): OfflineDoc[] {
  const next = listOfflineDocs();
  const key = next.map((d) => `${d.id}:${d.savedAt}`).join("|");
  if (key !== snapshotKey) {
    snapshotKey = key;
    snapshot = next;
  }
  return snapshot;
}
