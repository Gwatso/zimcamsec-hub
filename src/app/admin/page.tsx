import Link from "next/link";
import { formatBytes, formatCount } from "@/lib/format";
import { requireAdmin } from "@/server/auth/guards";
import { getDailyActivity, getOverview, getTopResources } from "@/server/services/metrics";
import { countOpenTickets } from "@/server/services/support";
import { getUserCounts } from "@/server/services/users";

export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [overview, users, daily, top, openTickets] = await Promise.all([
    getOverview(),
    getUserCounts(),
    getDailyActivity(14),
    getTopResources(10),
    countOpenTickets(),
  ]);
  const peak = Math.max(1, ...daily.map((d) => d.views + d.downloads));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Overview</h1>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total downloads" value={formatCount(overview.downloads)} sub={`${overview.events24h} opens in last 24h`} />
        <Kpi label="Resources" value={String(overview.resources)} sub={`${overview.published} published · ${formatBytes(overview.storageBytes)}`} />
        <Kpi label="Users" value={String(users.learners + users.teachers)} sub={`${users.learners} learners · ${users.teachers} teachers`} />
        <Kpi
          label="Needs attention"
          value={String(users.pendingTeachers + openTickets)}
          sub={
            <>
              <Link href="/admin/users?queue=1" className="underline">{users.pendingTeachers} teacher checks</Link> ·{" "}
              <Link href="/admin/support" className="underline">{openTickets} tickets</Link> ·{" "}
              <Link href="/admin/logs" className="underline">{overview.errors24h} errors (24h)</Link>
            </>
          }
        />
      </dl>

      <section className="card p-5" aria-labelledby="activity-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="activity-heading" className="font-semibold">Activity · last 14 days</h2>
          <p className="flex gap-4 text-xs text-stone-500">
            <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-heritage-600" /> Downloads</span>
            <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-gold-400" /> Views</span>
          </p>
        </div>
        {/* CSS bar chart: no charting library shipped to the browser. */}
        <ol className="mt-4 flex h-44 items-end gap-1.5" aria-label="Daily views and downloads">
          {daily.map((d) => (
            <li key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${d.downloads} downloads, ${d.views} views`}>
              <span className="sr-only">{`${d.day}: ${d.downloads} downloads, ${d.views} views`}</span>
              <span className="w-full rounded-t-sm bg-gold-400" style={{ height: `${(d.views / peak) * 100}%` }} />
              <span className="w-full bg-heritage-600" style={{ height: `${(d.downloads / peak) * 100}%` }} />
              <span aria-hidden className="mt-1 text-center text-[10px] text-stone-500">{d.day.slice(8)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card overflow-hidden" aria-labelledby="top-heading">
        <h2 id="top-heading" className="border-b border-stone-200 p-4 font-semibold dark:border-stone-800">Most downloaded</h2>
        <ol className="divide-y divide-stone-200 dark:divide-stone-800">
          {top.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-5 text-right text-stone-400 tabular-nums">{i + 1}</span>
              <Link href={`/resources/${r.slug}`} className="min-w-0 flex-1 truncate hover:underline">{r.title}</Link>
              <span className="font-semibold tabular-nums">{r.downloadCount.toLocaleString("en-ZW")}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="card p-5">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd className="mt-1 text-3xl font-extrabold text-heritage-700 dark:text-heritage-300">{value}</dd>
      <dd className="mt-1 text-xs text-stone-500">{sub}</dd>
    </div>
  );
}
