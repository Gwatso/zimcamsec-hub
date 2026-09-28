import { Feather } from "lucide-react";
import { toggleDataSaverAction } from "@/actions/preferences";
import { cn } from "@/lib/format";

/**
 * A plain form bound to a Server Action: works even before JavaScript loads
 * (or never loads on a very slow connection). The server re-renders the page
 * without thumbnails when Data-Saver is on.
 */
export function DataSaverToggle({ enabled, compact = false }: { enabled: boolean; compact?: boolean }) {
  return (
    <form action={toggleDataSaverAction}>
      <button
        type="submit"
        aria-pressed={enabled}
        title={enabled ? "Data-Saver is on: thumbnails hidden, live updates paused" : "Turn on Data-Saver to use less mobile data"}
        className={cn(
          "btn min-h-9 px-3 py-1.5 text-xs",
          enabled
            ? "bg-gold-500 text-heritage-950 hover:bg-gold-400"
            : "border border-white/30 text-white hover:bg-white/10",
        )}
      >
        <Feather aria-hidden className="size-4" />
        <span className={cn(compact && "sr-only")}>Data-Saver {enabled ? "on" : "off"}</span>
      </button>
    </form>
  );
}
