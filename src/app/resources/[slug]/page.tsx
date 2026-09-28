import { BadgeCheck, CalendarDays, FileText, Info, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DownloadCounter } from "@/components/resources/DownloadCounter";
import { DownloadButton, SaveOfflineButton } from "@/components/resources/ResourceActions";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { EducatorBadge, TierBadge, TypeBadge, resourceSubtitle } from "@/components/resources/ResourceMeta";
import { PdfViewer } from "@/components/viewer/PdfViewer";
import { resolveAccess } from "@/lib/access";
import { getSubject, getTier, levelLabel } from "@/lib/curriculum";
import { formatDate } from "@/lib/dates";
import { formatBytes } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/session";
import { getPreferences } from "@/server/preferences";
import { getRelatedResources, getResourceBySlug } from "@/server/services/resources";

type Params = Promise<{ slug: string }>;

// Shared between generateMetadata and the page within one request.
const loadResource = cache((slug: string) => getResourceBySlug(slug));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const resource = await loadResource((await params).slug);
  if (!resource) return { title: "Resource not found" };
  return {
    title: resource.title,
    description: resource.description || `${resourceSubtitle(resource)} — free on Zimcamsec Hub.`,
    alternates: { canonical: `/resources/${resource.slug}` },
  };
}

export default async function ResourcePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [resource, user, prefs] = await Promise.all([loadResource(slug), getCurrentUser(), getPreferences()]);
  if (!resource) notFound();

  const access = resolveAccess(user ? { role: user.role, teacherStatus: user.teacherStatus } : null, resource.audience);
  const related = await getRelatedResources(resource);
  const tier = getTier(resource.tier);
  const here = `/resources/${resource.slug}`;
  const signInHref = `/auth/sign-in?next=${encodeURIComponent(here)}`;
  const registerHref = `/auth/register?next=${encodeURIComponent(here)}`;

  const details: [string, string | undefined][] = [
    ["Curriculum tier", tier ? `${tier.code} · ${tier.title}` : undefined],
    ["Grade / Form", levelLabel(resource.level)],
    ["Subject / area", getSubject(resource.tier, resource.subject)?.name],
    ["Year", resource.year?.toString()],
    ["Exam session", resource.examSession ? (resource.examSession === "june" ? "June" : "November") : undefined],
    ["Paper", resource.paperNumber ? `Paper ${resource.paperNumber}` : undefined],
    ["File", `PDF · ${formatBytes(resource.fileSizeBytes)} · ${resource.pageCount} pages`],
    ["Added", formatDate(resource.createdAt)],
  ];

  return (
    <div className="container-page py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-stone-600 dark:text-stone-400">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link href="/resources" className="hover:underline">Resources</Link> /</li>
          {tier && <li><Link href={`/curriculum/${tier.slug}`} className="hover:underline">{tier.title}</Link> /</li>}
          <li aria-current="page" className="truncate text-stone-900 dark:text-stone-100">{resource.title}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={resource.resourceType} />
              <TierBadge tier={resource.tier} />
              {resource.audience === "educator" && <EducatorBadge />}
            </div>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{resource.title}</h1>
            <p className="mt-1 text-stone-600 dark:text-stone-400">{resourceSubtitle(resource)}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <DownloadCounter id={resource.id} initial={resource.downloadCount} size="lg" />
              <span className="flex items-center gap-1 text-sm text-stone-500">
                <FileText aria-hidden className="size-4" /> {formatBytes(resource.fileSizeBytes)}
              </span>
              <span className="flex items-center gap-1 text-sm text-stone-500">
                <CalendarDays aria-hidden className="size-4" /> {formatDate(resource.createdAt)}
              </span>
            </div>
          </header>

          {resource.description && <p className="max-w-3xl leading-relaxed text-stone-700 dark:text-stone-300">{resource.description}</p>}

          {access.canPreview ? (
            <PdfViewer
              key={`${resource.id}-${access.previewPages === null ? "full" : "preview"}`}
              resourceId={resource.id}
              src={`/api/resources/${resource.id}/file?mode=${access.previewPages === null ? "view" : "preview"}`}
              totalPages={resource.pageCount}
              previewLimit={access.previewPages}
              signInHref={signInHref}
              registerHref={registerHref}
              preferOfflineCopy={!!user}
            />
          ) : (
            <LockedPanel reason={access.reason} signInHref={signInHref} teacherStatus={user?.teacherStatus ?? null} />
          )}
        </div>

        <aside className="space-y-4">
          <div className="card space-y-3 p-5">
            {access.canDownload ? (
              <>
                <DownloadButton id={resource.id} slug={resource.slug} sizeBytes={resource.fileSizeBytes} />
                <SaveOfflineButton
                  doc={{
                    id: resource.id,
                    slug: resource.slug,
                    title: resource.title,
                    sizeBytes: resource.fileSizeBytes,
                    pageCount: resource.pageCount,
                    audience: resource.audience,
                  }}
                />
              </>
            ) : access.reason === "sign_in_required" ? (
              <>
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  <Lock aria-hidden className="mr-1 inline size-4" />
                  Sign in to download this PDF and save it for offline study. It&apos;s free.
                </p>
                <Link href={signInHref} className="btn-primary w-full">Sign in to download</Link>
                <Link href={registerHref} className="btn-secondary w-full">Create free account</Link>
              </>
            ) : (
              <p className="text-sm text-stone-700 dark:text-stone-300">Downloads are limited to verified educators.</p>
            )}
            {prefs.dataSaver && (
              <p className="text-xs text-stone-500">Data-Saver is on: the preview loads only when you tap it.</p>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-semibold">Details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {details
                .filter((d): d is [string, string] => !!d[1])
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-stone-500">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
            </dl>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-stone-100 p-4 text-xs text-stone-600 dark:bg-stone-900 dark:text-stone-400">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>
              Compiled from publicly circulated sources. Not an official MoPSE or examination board publication. Spotted an error
              or own the rights? <Link href="/support?category=content-error" className="underline">Let us know</Link>.
            </p>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-12" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xl font-bold">Related resources</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <ResourceCard key={r.id} resource={r} dataSaver={prefs.dataSaver} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LockedPanel({
  reason,
  signInHref,
  teacherStatus,
}: {
  reason: string;
  signInHref: string;
  teacherStatus: "pending" | "verified" | "rejected" | null;
}) {
  return (
    <section className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-gold-100 dark:bg-gold-900/40">
        <BadgeCheck aria-hidden className="size-7 text-gold-700 dark:text-gold-300" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">For verified educators</h2>
      <p className="mt-2 max-w-md text-sm text-stone-600 dark:text-stone-400">
        {teacherStatus === "pending"
          ? "Your teacher verification is in progress. You'll get access as soon as our team confirms your EC Number and school."
          : teacherStatus === "rejected"
            ? "We couldn't verify your teacher details. Please contact support so we can help."
            : "Schemes of work, marking schemes, teacher syllabi and administrative circulars are available to teachers who register with their EC Number and school."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {reason === "sign_in_required" ? (
          <>
            <Link href={signInHref} className="btn-primary">Sign in</Link>
            <Link href="/auth/register?role=teacher" className="btn-gold">Register as a teacher</Link>
          </>
        ) : (
          <Link href="/support?category=teacher-verification" className="btn-secondary">Contact support</Link>
        )}
      </div>
    </section>
  );
}
