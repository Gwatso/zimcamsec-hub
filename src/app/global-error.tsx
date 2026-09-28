"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client/telemetry";

/** Last-resort boundary when the root layout itself fails. Must render its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!error.digest) reportClientError("react", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1rem", textAlign: "center", color: "#152313" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Zimcamsec Hub is having trouble</h1>
        <p>Please try again in a moment.</p>
        {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12 }}>Reference: {error.digest}</p>}
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: 16, padding: "10px 20px", background: "#4F7942", color: "#fff", border: 0, borderRadius: 8 }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
