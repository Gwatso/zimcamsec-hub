import { LayoutGrid, List, SearchX } from "lucide-react";
import Link from "next/link";
import { cn, pluralize } from "@/lib/format";
import type { CatalogueQuery } from "@/lib/validation";
import { getPreferences } from "@/server/preferences";
import { getAvailableYears, listResources } from "@/server/services/resources";
import { CatalogueFilters } from "./CatalogueFilters";
import { Pagination, hrefWith } from "./Pagination";
import { ResourceCard } from "./ResourceCard";

/** Server component: filters + results + pagination for /resources and tier pages. */
export async function ResourceCatalogue({
  query,
  basePath,
  lockedTier,
}: {
  query: CatalogueQuery;
  basePath: string;
  lockedTier?: CatalogueQuery["tier"];
}) {
  const effective = lockedTier ? { ...query, tier: lockedTier } : query;
  const [result, years, prefs] = await Promise.all([
    listResources(effective),
    getAvailableYears(effective.tier),
    getPreferences(),
  ]);

  const params: Record<string, string | number | undefined> = {
    q: query.q,
    tier: lockedTier ? undefined : query.tier,
    level: query.level,
    subject: query.subject,
    type: query.type,
    year: query.year,
    sort: query.sort === (query.q ? "relevance" : "popular") ? undefined : query.sort,
    view: query.view === "list" ? "list" : undefined,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <CatalogueFilters key={JSON.stringify(params)} action={basePath} query={effective} lockedTier={lockedTier} years={years} />
      </aside>

      <section aria-labelledby="results-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="results-heading" className="text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
            {pluralize(result.total, "resource")}
            {query.q && (
              <>
                {" "}for <strong className="text-stone-900 dark:text-stone-100">“{query.q}”</strong>
              </>
            )}
          </h2>
          <div className="flex rounded-lg border border-stone-300 p-0.5 dark:border-stone-700" role="group" aria-label="Layout">
            <ViewLink href={hrefWith(basePath, params, { view: undefined, page: result.page })} active={query.view === "grid"} label="Grid view">
              <LayoutGrid aria-hidden className="size-4" />
            </ViewLink>
            <ViewLink href={hrefWith(basePath, params, { view: "list", page: result.page })} active={query.view === "list"} label="List view">
              <List aria-hidden className="size-4" />
            </ViewLink>
          </div>
        </div>

        {result.items.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-16 text-center">
            <SearchX aria-hidden className="size-10 text-stone-400" />
            <h3 className="mt-4 text-lg font-semibold">No resources match these filters</h3>
            <p className="mt-2 max-w-md text-sm text-stone-600 dark:text-stone-400">
              Try removing a filter or searching with fewer words. Can&apos;t find what you need? Ask us to add it.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href={basePath} className="btn-secondary">
                Clear filters
              </Link>
              <Link href="/support?category=missing-resource" className="btn-primary">
                Request a resource
              </Link>
            </div>
          </div>
        ) : (
          <ul
            className={cn(
              query.view === "list" ? "space-y-3" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
            )}
          >
            {result.items.map((r) => (
              <ResourceCard key={r.id} resource={r} view={query.view} dataSaver={prefs.dataSaver} />
            ))}
          </ul>
        )}

        <Pagination base={basePath} params={params} page={result.page} pageCount={result.pageCount} />
      </section>
    </div>
  );
}

function ViewLink({ href, active, label, children }: { href: string; active: boolean; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md",
        active ? "bg-heritage-600 text-white" : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
      )}
    >
      {children}
    </Link>
  );
}
