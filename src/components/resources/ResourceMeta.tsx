import { Lock } from "lucide-react";
import { getResourceType, getSubject, getTier, levelLabel } from "@/lib/curriculum";
import { cn } from "@/lib/format";

interface MetaResource {
  tier: string;
  level: string | null;
  subject: string | null;
  resourceType: string;
  audience: "public" | "educator";
  year: number | null;
  examSession: "june" | "november" | null;
  paperNumber: number | null;
}

const TYPE_COLORS: Record<string, string> = {
  "past-paper": "bg-heritage-600 text-white",
  "specimen-paper": "bg-gold-500 text-heritage-950",
  "marking-scheme": "bg-heritage-900 text-gold-200",
  "scheme-of-work": "bg-heritage-900 text-gold-200",
  "teacher-syllabus": "bg-heritage-900 text-gold-200",
  "admin-circular": "bg-heritage-900 text-gold-200",
};

export function resourceSubtitle(r: MetaResource): string {
  const parts = [
    levelLabel(r.level),
    getSubject(r.tier, r.subject)?.name,
    r.paperNumber ? `Paper ${r.paperNumber}` : undefined,
    r.examSession && r.year ? `${r.examSession === "june" ? "June" : "November"} ${r.year}` : r.year ? String(r.year) : undefined,
  ].filter(Boolean);
  return parts.join(" · ") || (getTier(r.tier)?.title ?? "");
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className={cn("badge", TYPE_COLORS[type] ?? "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-100")}>
      {getResourceType(type)?.label ?? type}
    </span>
  );
}

export function EducatorBadge() {
  return (
    <span className="badge bg-gold-100 text-gold-900 ring-1 ring-gold-300 dark:bg-gold-900/40 dark:text-gold-200 dark:ring-gold-700">
      <Lock aria-hidden className="size-3" /> Teachers only
    </span>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const t = getTier(tier);
  if (!t) return null;
  return (
    <span className="badge bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
      {t.code} · {t.title}
    </span>
  );
}
