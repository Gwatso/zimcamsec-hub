import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export function hrefWith(base: string, params: Record<string, string | number | undefined>, patch: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) {
    if (v !== undefined && v !== "" && !(k === "page" && Number(v) === 1)) search.set(k, String(v));
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

export function Pagination({
  base,
  params,
  page,
  pageCount,
}: {
  base: string;
  params: Record<string, string | number | undefined>;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  // Compact window: 1 … 4 5 [6] 7 8 … 20
  const pages = new Set([1, pageCount, page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-1">
      {page > 1 && (
        <Link href={hrefWith(base, params, { page: page - 1 })} className="btn-secondary min-h-10 px-3" rel="prev">
          <ChevronLeft aria-hidden className="size-4" /> <span className="sr-only sm:not-sr-only">Previous</span>
        </Link>
      )}
      {sorted.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && p - (sorted[i - 1] ?? p) > 1 && <span className="px-1 text-stone-400">…</span>}
          {p === page ? (
            <span aria-current="page" className="btn min-h-10 bg-heritage-600 px-3.5 text-white">
              {p}
            </span>
          ) : (
            <Link href={hrefWith(base, params, { page: p })} className="btn-ghost min-h-10 px-3.5">
              {p}
            </Link>
          )}
        </span>
      ))}
      {page < pageCount && (
        <Link href={hrefWith(base, params, { page: page + 1 })} className="btn-secondary min-h-10 px-3" rel="next">
          <span className="sr-only sm:not-sr-only">Next</span> <ChevronRight aria-hidden className="size-4" />
        </Link>
      )}
    </nav>
  );
}
