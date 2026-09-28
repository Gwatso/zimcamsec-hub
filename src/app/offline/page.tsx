import type { Metadata } from "next";
import { Suspense } from "react";
import { OfflineReader } from "./OfflineReader";

export const metadata: Metadata = { title: "Saved offline", robots: { index: false } };

/**
 * Pre-cached by the service worker, so it opens with no connection at all.
 * Everything it shows comes from this device (Cache API + localStorage).
 */
export default function OfflinePage() {
  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold">Saved offline</h1>
      <p className="mt-1 max-w-2xl text-stone-600 dark:text-stone-400">
        Documents you&apos;ve saved to this device. They open without internet or mobile data.
      </p>
      <div className="mt-6">
        <Suspense>
          <OfflineReader />
        </Suspense>
      </div>
    </div>
  );
}
