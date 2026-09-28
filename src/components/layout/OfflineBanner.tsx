"use client";

import { WifiOff } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Announces offline state (role=status is read out by screen readers). */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="status" className="bg-gold-500 text-heritage-950">
      <div className="container-page flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm font-medium">
        <WifiOff aria-hidden className="size-4 shrink-0" />
        <span>You&apos;re offline. You can still read pages you&apos;ve visited and documents saved to this device.</span>
        <Link href="/offline" className="underline underline-offset-2">
          Open saved documents
        </Link>
      </div>
    </div>
  );
}
