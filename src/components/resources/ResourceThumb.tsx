import { getResourceType, getSubject } from "@/lib/curriculum";
import { cn } from "@/lib/format";

/**
 * Card artwork. With a cover image we lazy-load it (explicit size, no layout
 * shift); otherwise a CSS-only tile with the subject's initials costs zero
 * bytes. In Data-Saver mode the server doesn't render covers at all.
 */
export function ResourceThumb({
  id,
  title,
  tier,
  subject,
  resourceType,
  hasCover,
  dataSaver,
  className,
}: {
  id: string;
  title: string;
  tier: string;
  subject: string | null;
  resourceType: string;
  hasCover: boolean;
  dataSaver: boolean;
  className?: string;
}) {
  if (hasCover && !dataSaver) {
    return (
      // Plain <img>: covers are tiny and pre-sized; next/image would pull in a native optimiser.
      <img
        data-heavy
        src={`/api/resources/${id}/cover`}
        alt=""
        width={320}
        height={180}
        loading="lazy"
        decoding="async"
        className={cn("aspect-video w-full rounded-t-xl object-cover", className)}
      />
    );
  }

  if (dataSaver) return null;

  const label = getSubject(tier, subject)?.name ?? getResourceType(resourceType)?.label ?? title;
  const initials = label
    .split(/[\s&,-]+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div
      aria-hidden
      className={cn(
        "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-t-xl bg-gradient-to-br from-heritage-600 to-heritage-800",
        className,
      )}
    >
      <div className="absolute -top-6 -right-6 size-24 rounded-full bg-gold-500/30" />
      <div className="absolute -bottom-8 -left-4 size-20 rounded-full bg-white/10" />
      <span className="relative text-3xl font-black tracking-tight text-white/90">{initials || "Z"}</span>
    </div>
  );
}
