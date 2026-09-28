import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceCatalogue } from "@/components/resources/ResourceCatalogue";
import { getTier, isTierSlug } from "@/lib/curriculum";
import { cn } from "@/lib/format";
import { catalogueQuerySchema, firstValues } from "@/lib/validation";
import { getSubjectCounts } from "@/server/services/resources";

type Params = Promise<{ tier: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const tier = getTier((await params).tier);
  if (!tier) return { title: "Not found" };
  return { title: `${tier.title} (${tier.range})`, description: tier.summary };
}

export default async function TierPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { tier: slug } = await params;
  if (!isTierSlug(slug)) notFound();
  const tier = getTier(slug)!;
  const query = catalogueQuerySchema.parse({ ...firstValues(await searchParams), tier: slug });
  const subjectCounts = await getSubjectCounts(slug);
  const base = `/curriculum/${slug}`;

  // Group subjects by pathway (Core / STEM / Commercials …) where the tier defines groups.
  const groups = new Map<string, typeof tier.subjects>();
  for (const s of tier.subjects) {
    const key = s.group ?? "Subjects";
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  return (
    <>
      <section className="bg-heritage-800 text-white dark:bg-heritage-950">
        <div className="container-page py-10">
          <p className="text-sm font-bold tracking-wider text-gold-300 uppercase">{tier.code}</p>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{tier.title}</h1>
          <p className="mt-1 text-heritage-100">{tier.range}</p>
          <p className="mt-3 max-w-2xl text-heritage-100">{tier.summary}</p>

          {tier.levels.length > 0 && (
            <nav aria-label={`${tier.title} levels`} className="mt-6 flex flex-wrap gap-2">
              <LevelChip href={base} active={!query.level}>All levels</LevelChip>
              {tier.levels.map((l) => (
                <LevelChip key={l.slug} href={`${base}?level=${l.slug}`} active={query.level === l.slug}>
                  {l.label}
                </LevelChip>
              ))}
            </nav>
          )}
        </div>
      </section>

      <div className="container-page py-8">
        <section aria-labelledby="subjects-heading" className="mb-10">
          <h2 id="subjects-heading" className="text-xl font-bold">
            {slug === "policy" ? "Document categories" : "Subjects & learning areas"}
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[...groups.entries()].map(([group, subjects]) => (
              <div key={group}>
                {groups.size > 1 && <h3 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">{group}</h3>}
                <ul className="grid gap-2">
                  {subjects.map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={`${base}?subject=${s.slug}${query.level ? `&level=${query.level}` : ""}`}
                        className={cn(
                          "card flex items-center justify-between px-4 py-3 text-sm font-medium hover:border-heritage-400",
                          query.subject === s.slug && "border-heritage-600 ring-2 ring-heritage-600/20",
                        )}
                      >
                        {s.name}
                        <span className="text-xs text-stone-500">{subjectCounts[s.slug] ?? 0}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <ResourceCatalogue query={query} basePath={base} lockedTier={slug} />
      </div>
    </>
  );
}

function LevelChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium",
        active ? "bg-gold-500 text-heritage-950" : "bg-white/10 hover:bg-white/20",
      )}
    >
      {children}
    </Link>
  );
}
