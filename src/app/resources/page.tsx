import type { Metadata } from "next";
import { ResourceCatalogue } from "@/components/resources/ResourceCatalogue";
import { getTier } from "@/lib/curriculum";
import { catalogueQuerySchema, firstValues } from "@/lib/validation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const query = catalogueQuerySchema.parse(firstValues(await searchParams));
  const tier = query.tier ? getTier(query.tier)?.title : undefined;
  const title = query.q ? `Search: ${query.q}` : tier ? `${tier} resources` : "All resources";
  return {
    title,
    // Keep filtered/searched permutations out of search engines; the canonical list stays indexable.
    robots: query.q || query.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function ResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = catalogueQuerySchema.parse(firstValues(await searchParams));
  return (
    <div className="container-page py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Resources</h1>
        <p className="mt-1 text-stone-600 dark:text-stone-400">
          Past papers, specimen papers, notes, syllabi, schemes of work and policy documents — ECD A to Form 6.
        </p>
      </header>
      <ResourceCatalogue query={query} basePath="/resources" />
    </div>
  );
}
