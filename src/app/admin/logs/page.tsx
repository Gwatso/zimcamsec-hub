import { Monitor, Server, Trash2 } from "lucide-react";
import Link from "next/link";
import { purgeLogsAction } from "@/actions/admin";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/format";
import { requireAdmin } from "@/server/auth/guards";
import { listErrorGroups } from "@/server/services/error-logs";

export const metadata = { title: "System logs" };

type SearchParams = Promise<{ source?: string }>;

export default async function AdminLogsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const source = params.source === "server" || params.source === "client" ? params.source : "all";
  const groups = await listErrorGroups(source);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">System logs</h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Unhandled server errors and browser exceptions / promise rejections, grouped by cause.
          </p>
        </div>
        <form action={purgeLogsAction}>
          <input type="hidden" name="olderThanDays" value="30" />
          <ConfirmButton message="Delete all log entries older than 30 days?" className="btn-secondary min-h-9 text-xs">
            <Trash2 aria-hidden className="size-4" /> Purge &gt; 30 days
          </ConfirmButton>
        </form>
      </div>

      <nav className="flex gap-2" aria-label="Log source">
        {(["all", "server", "client"] as const).map((s) => (
          <Link key={s} href={`/admin/logs?source=${s}`} aria-current={s === source ? "page" : undefined} className={cn(s === source ? "btn-primary" : "btn-secondary", "min-h-9 capitalize")}>
            {s}
          </Link>
        ))}
      </nav>

      {groups.length === 0 ? (
        <p className="card p-6 text-center text-stone-500">No errors recorded. 🎉</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={`${g.fingerprint}-${g.source}`} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-xs text-stone-500">
                    {g.source === "server" ? <Server aria-hidden className="size-3.5" /> : <Monitor aria-hidden className="size-3.5" />}
                    {g.source} · {g.occurrences}× · last {g.lastSeen ? formatDateTime(g.lastSeen) : "—"} · first {g.firstSeen ? formatDateTime(g.firstSeen) : "—"}
                  </p>
                  <p className="mt-1 font-mono text-sm break-words">{g.message}</p>
                  {g.url && <p className="mt-1 truncate text-xs text-stone-500">{g.url}</p>}
                </div>
                <form action={purgeLogsAction}>
                  <input type="hidden" name="fingerprint" value={g.fingerprint} />
                  <button type="submit" className="btn-ghost min-h-9 text-xs">Resolve</button>
                </form>
              </div>
              {g.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-stone-500">Stack trace</summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded bg-stone-950 p-3 text-xs text-stone-100">{g.stack}</pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
