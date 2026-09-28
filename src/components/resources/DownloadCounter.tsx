"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getCount, register, seedCount, subscribe } from "@/lib/client/live-counts";
import { cn, formatCount } from "@/lib/format";

/**
 * Live social-proof badge. Server-rendered with the real count (so it's
 * correct with JS disabled), then kept fresh by the shared live-counts store.
 */
export function DownloadCounter({ id, initial, size = "sm" }: { id: string; initial: number; size?: "sm" | "lg" }) {
  seedCount(id, initial);
  const value = useSyncExternalStore(
    subscribe,
    () => getCount(id) ?? initial,
    () => initial,
  );
  const previous = useRef(value);
  const [bump, setBump] = useState(0);

  useEffect(() => register(id), [id]);
  useEffect(() => {
    if (value > previous.current) setBump((b) => b + 1);
    previous.current = value;
  }, [value]);

  const label = `${value.toLocaleString("en-ZW")} ${value === 1 ? "download" : "downloads"}`;
  return (
    <span
      className={cn(
        "badge bg-heritage-50 font-semibold text-heritage-800 ring-1 ring-heritage-200 dark:bg-heritage-950 dark:text-heritage-200 dark:ring-heritage-800",
        size === "lg" && "px-3 py-1 text-sm",
      )}
      title={label}
    >
      <Download aria-hidden className={size === "lg" ? "size-4" : "size-3"} />
      <span key={bump} className={cn("tabular-nums", bump > 0 && "animate-count-bump inline-block")} aria-hidden>
        {formatCount(value)}
      </span>
      <span className="sr-only" aria-live="polite">
        {label}
      </span>
    </span>
  );
}
