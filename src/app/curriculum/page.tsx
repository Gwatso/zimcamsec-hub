import type { Metadata } from "next";
import Link from "next/link";
import { TIERS } from "@/lib/curriculum";
import { pluralize } from "@/lib/format";
import { getTierCounts } from "@/server/services/resources";

export const metadata: Metadata = {
  title: "Curriculum map",
  description: "The five tiers of Zimbabwe's Heritage-Based Curriculum, from ECD A to Form 6, plus the Policy & ICT Strategy hub.",
};

export default async function CurriculumPage() {
  const counts = await getTierCounts();
  return (
    <div className="container-page py-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold">Heritage-Based Curriculum map</h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          Resources are organised into four teaching tiers and a policy module, following the Ministry of Primary and
          Secondary Education structure from ECD A through Form 6.
        </p>
      </header>

      <ol className="mt-8 space-y-6">
        {TIERS.map((tier) => (
          <li key={tier.slug} className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-l-8 border-heritage-600 p-5">
              <div>
                <p className="text-xs font-bold tracking-wider text-gold-700 uppercase dark:text-gold-400">{tier.code}</p>
                <h2 className="text-xl font-bold">
                  <Link href={`/curriculum/${tier.slug}`} className="hover:underline">
                    {tier.title}
                  </Link>{" "}
                  <span className="text-base font-normal text-stone-500">({tier.range})</span>
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-stone-600 dark:text-stone-400">{tier.summary}</p>
              </div>
              <Link href={`/curriculum/${tier.slug}`} className="btn-primary">
                {pluralize(counts[tier.slug], "resource")}
              </Link>
            </div>
            <div className="border-t border-stone-200 px-5 py-4 dark:border-stone-800">
              {tier.levels.length > 0 && (
                <p className="mb-3 text-sm">
                  <span className="font-medium">Levels: </span>
                  {tier.levels.map((l, i) => (
                    <span key={l.slug}>
                      {i > 0 && " · "}
                      <Link href={`/curriculum/${tier.slug}?level=${l.slug}`} className="text-heritage-700 hover:underline dark:text-heritage-300">
                        {l.label}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
              <ul className="flex flex-wrap gap-2">
                {tier.subjects.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/curriculum/${tier.slug}?subject=${s.slug}`}
                      className="inline-block rounded-full bg-stone-100 px-3 py-1 text-sm hover:bg-heritage-100 dark:bg-stone-800 dark:hover:bg-heritage-900"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
