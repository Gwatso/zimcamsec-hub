"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { reportClientError } from "@/lib/client/telemetry";

/**
 * Route-level error boundary. Server errors are already captured by
 * instrumentation.onRequestError; this reports client render errors and gives
 * the user a way forward instead of a blank screen.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!error.digest) reportClientError("react", error);
  }, [error]);

  return (
    <div className="container-page flex flex-col items-center py-24 text-center" role="alert">
      <AlertTriangle aria-hidden className="size-14 text-gold-600" />
      <h1 className="mt-4 text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-stone-600 dark:text-stone-400">
        This has been reported to our team. Please try again — if you&apos;re on a weak connection, waiting a moment often helps.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-stone-500">Error reference: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="btn-primary">Try again</button>
        <Link href="/" className="btn-secondary">Go home</Link>
      </div>
    </div>
  );
}
