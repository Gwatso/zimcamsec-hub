import { ArrowRight, BadgeCheck, CloudOff, Feather, FileSearch, HeartHandshake, Search, ShieldCheck } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { TIERS } from "@/lib/curriculum";
import { formatCount, pluralize } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/session";
import { getPreferences } from "@/server/preferences";
import { getLatestResources, getPlatformStats, getTierCounts, getTrendingResources } from "@/server/services/resources";

const QUICK_LINKS = [
  { label: "O-Level past papers", href: "/resources?tier=lower-secondary&type=past-paper" },
  { label: "A-Level past papers", href: "/resources?tier=upper-secondary&type=past-paper" },
  { label: "Grade 7 specimens", href: "/resources?tier=junior&level=grade-7&type=specimen-paper" },
  { label: "Schemes of work", href: "/resources?type=scheme-of-work" },
  { label: "Ministry circulars", href: "/curriculum/policy" },
];

const VALUES = [
  { icon: HeartHandshake, title: "Free for everyone", text: "No paywalls or hidden fees — every learner deserves the same materials." },
  { icon: Feather, title: "Built for low data", text: "Data-Saver mode, page-by-page PDF loading and no heavy images or fonts." },
  { icon: CloudOff, title: "Works offline", text: "Save papers to your phone and revise without a connection." },
  { icon: ShieldCheck, title: "Safe for learners", text: "Minimal data from learners 17 and under; guardian contact for under-13s." },
];

export default async function HomePage() {
  const [stats, tierCounts, trending, latest, prefs, user] = await Promise.all([
    getPlatformStats(),
    getTierCounts(),
    getTrendingResources(6),
    getLatestResources(6),
    getPreferences(),
    getCurrentUser(),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-heritage-800 text-white dark:bg-heritage-950">
        <div aria-hidden className="absolute -top-24 -right-24 size-96 rounded-full bg-gold-500/20" />
        <div aria-hidden className="absolute -bottom-32 left-1/3 size-80 rounded-full bg-heritage-500/30" />
        <div className="container-page relative py-14 sm:py-20">
          <p className="text-sm font-semibold tracking-wider text-gold-300 uppercase">Heritage-Based Curriculum · ECD A to Form 6</p>
          <h1 className="mt-3 max-w-3xl text-3xl leading-tight font-extrabold sm:text-5xl">
            Past papers, notes and teaching resources for every Zimbabwean classroom.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-heritage-100">
            Free, fast and offline-friendly — designed for mobile data, rural connections and busy teachers.
          </p>

          <Form action="/resources" role="search" className="mt-8 flex max-w-2xl gap-2 rounded-xl bg-white p-2 shadow-lg">
            <label htmlFor="hero-q" className="sr-only">
              Search resources
            </label>
            <input
              id="hero-q"
              name="q"
              type="search"
              placeholder="Search e.g. “Form 4 Geography” or “Grade 7 maths 2023”"
              className="min-h-11 w-full rounded-lg px-3 text-base text-stone-900 outline-none placeholder:text-stone-400"
              maxLength={120}
              enterKeyHint="search"
            />
            <button type="submit" className="btn-primary shrink-0">
              <Search aria-hidden className="size-4" /> <span className="hidden sm:inline">Search</span>
            </button>
          </Form>

          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Popular searches">
            {QUICK_LINKS.map((q) => (
              <li key={q.href}>
                <Link href={q.href} className="inline-block rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
                  {q.label}
                </Link>
              </li>
            ))}
          </ul>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/15 pt-6">
            <Stat label="Resources" value={formatCount(stats.resources)} />
            <Stat label="Downloads" value={formatCount(stats.downloads)} />
            <Stat label="Curriculum tiers" value="5" />
          </dl>
        </div>
      </section>

      {/* Tiers */}
      <section className="container-page py-14" aria-labelledby="tiers-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="tiers-heading" className="text-2xl font-bold">
              Find resources by level
            </h2>
            <p className="mt-1 text-stone-600 dark:text-stone-400">Organised exactly like the MoPSE Heritage-Based Curriculum.</p>
          </div>
          <Link href="/curriculum" className="hidden text-sm font-semibold text-heritage-700 hover:underline sm:inline dark:text-heritage-300">
            Full curriculum map →
          </Link>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {TIERS.map((tier) => (
            <li key={tier.slug}>
              <Link
                href={`/curriculum/${tier.slug}`}
                className="card group flex h-full flex-col border-t-4 border-t-heritage-600 p-5 transition-shadow hover:shadow-md"
              >
                <span className="text-xs font-bold tracking-wider text-gold-700 uppercase dark:text-gold-400">{tier.code}</span>
                <span className="mt-1 text-lg font-bold group-hover:text-heritage-700 dark:group-hover:text-heritage-300">{tier.title}</span>
                <span className="text-sm text-stone-600 dark:text-stone-400">{tier.range}</span>
                <span className="mt-auto pt-4 text-sm font-medium text-heritage-700 dark:text-heritage-300">
                  {pluralize(tierCounts[tier.slug], "resource")} <ArrowRight aria-hidden className="inline size-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Trending */}
      {trending.length > 0 && (
        <section className="bg-white py-14 dark:bg-stone-900/40" aria-labelledby="trending-heading">
          <div className="container-page">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 id="trending-heading" className="text-2xl font-bold">
                  Trending this week
                </h2>
                <p className="mt-1 text-stone-600 dark:text-stone-400">What learners and teachers across Zimbabwe are opening right now.</p>
              </div>
              <Link href="/resources?sort=popular" className="text-sm font-semibold text-heritage-700 hover:underline dark:text-heritage-300">
                See all →
              </Link>
            </div>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trending.map((r) => (
                <ResourceCard key={r.id} resource={r} dataSaver={prefs.dataSaver} />
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Values */}
      <section className="container-page py-14" aria-labelledby="values-heading">
        <h2 id="values-heading" className="text-2xl font-bold">
          Built for Zimbabwe&apos;s realities
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="card p-5">
              <Icon aria-hidden className="size-6 text-heritage-600" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Latest */}
      {latest.length > 0 && (
        <section className="container-page pb-14" aria-labelledby="latest-heading">
          <div className="flex items-end justify-between gap-4">
            <h2 id="latest-heading" className="text-2xl font-bold">
              Recently added
            </h2>
            <Link href="/resources?sort=newest" className="text-sm font-semibold text-heritage-700 hover:underline dark:text-heritage-300">
              See all →
            </Link>
          </div>
          <ul className="mt-6 space-y-3">
            {latest.map((r) => (
              <ResourceCard key={r.id} resource={r} view="list" dataSaver={prefs.dataSaver} />
            ))}
          </ul>
        </section>
      )}

      {/* Teacher CTA */}
      {!user && (
        <section className="container-page">
          <div className="flex flex-col items-start gap-6 rounded-2xl bg-gradient-to-r from-heritage-700 to-heritage-900 p-8 text-white md:flex-row md:items-center">
            <BadgeCheck aria-hidden className="size-12 shrink-0 text-gold-400" />
            <div className="flex-1">
              <h2 className="text-xl font-bold">Are you a teacher?</h2>
              <p className="mt-1 text-heritage-100">
                Register with your EC Number and school to unlock schemes of work, teacher syllabi and administrative circulars,
                and earn a verified teacher badge.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/auth/register?role=teacher" className="btn-gold">
                Register as a teacher
              </Link>
              <Link href="/auth/register" className="btn border border-white/40 text-white hover:bg-white/10">
                <FileSearch aria-hidden className="size-4" /> I&apos;m a learner
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-heritage-200 uppercase">{label}</dt>
      <dd className="text-2xl font-extrabold text-gold-300">{value}</dd>
    </div>
  );
}
