import { FileText } from "lucide-react";
import Link from "next/link";
import { formatBytes } from "@/lib/format";
import type { ResourceSummary } from "@/server/services/resources";
import { DownloadCounter } from "./DownloadCounter";
import { EducatorBadge, TypeBadge, resourceSubtitle } from "./ResourceMeta";
import { ResourceThumb } from "./ResourceThumb";

export function ResourceCard({
  resource: r,
  view = "grid",
  dataSaver,
}: {
  resource: ResourceSummary;
  view?: "grid" | "list";
  dataSaver: boolean;
}) {
  const href = `/resources/${r.slug}`;
  const size = `${formatBytes(r.fileSizeBytes)} · ${r.pageCount} ${r.pageCount === 1 ? "page" : "pages"}`;

  if (view === "list") {
    return (
      <li className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-md">
        <span aria-hidden className="hidden size-11 shrink-0 items-center justify-center rounded-lg bg-heritage-50 text-heritage-700 sm:flex dark:bg-heritage-950 dark:text-heritage-300">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">
            <Link href={href} className="hover:text-heritage-700 hover:underline dark:hover:text-heritage-300">
              {r.title}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-sm text-stone-600 dark:text-stone-400">{resourceSubtitle(r)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TypeBadge type={r.resourceType} />
            {r.audience === "educator" && <EducatorBadge />}
            <span className="text-xs text-stone-500 dark:text-stone-400">{size}</span>
          </div>
        </div>
        <DownloadCounter id={r.id} initial={r.downloadCount} />
      </li>
    );
  }

  return (
    <li className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <ResourceThumb
        id={r.id}
        title={r.title}
        tier={r.tier}
        subject={r.subject}
        resourceType={r.resourceType}
        hasCover={r.hasCover}
        dataSaver={dataSaver}
      />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={r.resourceType} />
          {r.audience === "educator" && <EducatorBadge />}
        </div>
        <h3 className="mt-2 font-semibold leading-snug">
          {/* Stretched link: the whole card is clickable, but only one tab stop. */}
          <Link href={href} className="after:absolute after:inset-0 group-hover:text-heritage-700 dark:group-hover:text-heritage-300">
            {r.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{resourceSubtitle(r)}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className="text-xs text-stone-500 dark:text-stone-400">{size}</span>
          <span className="relative z-10">
            <DownloadCounter id={r.id} initial={r.downloadCount} />
          </span>
        </div>
      </div>
    </li>
  );
}
