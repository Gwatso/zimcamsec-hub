import { CheckCircle2, Mail, RefreshCw, RotateCcw } from "lucide-react";
import Link from "next/link";
import { retryTicketDeliveryAction, setTicketStatusAction } from "@/actions/admin";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/format";
import { SUPPORT_CATEGORIES } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/guards";
import { getEnv } from "@/server/env";
import { listTickets } from "@/server/services/support";

export const metadata = { title: "Support desk" };

const DELIVERY: Record<string, { label: string; className: string }> = {
  sent: { label: "E-mailed", className: "bg-heritage-100 text-heritage-800" },
  pending: { label: "Sending", className: "bg-stone-200 text-stone-700" },
  failed: { label: "E-mail failed", className: "bg-red-100 text-red-900" },
  not_configured: { label: "Stored only (mail not configured)", className: "bg-gold-100 text-gold-900" },
};

type SearchParams = Promise<{ status?: string }>;

export default async function AdminSupportPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const status = params.status === "resolved" || params.status === "all" ? params.status : "open";
  const tickets = await listTickets(status);
  const inbox = getEnv().SUPPORT_INBOX;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support desk</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Every ticket is stored here and forwarded to <strong>{inbox}</strong>. Reply from that inbox — each e-mail&apos;s
          Reply-To is the sender.
        </p>
      </div>

      <nav className="flex gap-2" aria-label="Ticket status">
        {(["open", "resolved", "all"] as const).map((s) => (
          <Link key={s} href={`/admin/support?status=${s}`} aria-current={s === status ? "page" : undefined} className={cn(s === status ? "btn-primary" : "btn-secondary", "min-h-9 capitalize")}>
            {s}
          </Link>
        ))}
      </nav>

      {tickets.length === 0 ? (
        <p className="card p-6 text-center text-stone-500">No {status === "all" ? "" : status} tickets.</p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => {
            const delivery = DELIVERY[t.deliveryStatus] ?? DELIVERY.pending!;
            return (
              <li key={t.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-stone-500">{t.reference} · {formatDateTime(t.createdAt)}</p>
                    <h2 className="font-semibold">
                      {SUPPORT_CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}
                    </h2>
                    <p className="text-sm">
                      {t.firstName} {t.surname} ·{" "}
                      <a href={`mailto:${t.email}?subject=${encodeURIComponent(`Re: [${t.reference}]`)}`} className="text-heritage-700 underline dark:text-heritage-300">
                        {t.email}
                      </a>
                      {t.phone && <> · {t.phone}</>}
                      {t.userId && <span className="badge ml-2 bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">Registered user</span>}
                    </p>
                  </div>
                  <span className={cn("badge", delivery.className)} title={t.deliveryError ?? undefined}>
                    <Mail aria-hidden className="size-3" /> {delivery.label}
                  </span>
                </div>
                <p className="mt-3 text-sm whitespace-pre-wrap text-stone-700 dark:text-stone-300">{t.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={setTicketStatusAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="status" value={t.status === "open" ? "resolved" : "open"} />
                    <button type="submit" className="btn-secondary min-h-9 text-xs">
                      {t.status === "open" ? <><CheckCircle2 aria-hidden className="size-4" /> Mark resolved</> : <><RotateCcw aria-hidden className="size-4" /> Reopen</>}
                    </button>
                  </form>
                  {t.deliveryStatus !== "sent" && (
                    <form action={retryTicketDeliveryAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="btn-ghost min-h-9 text-xs">
                        <RefreshCw aria-hidden className="size-4" /> Retry e-mail
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
