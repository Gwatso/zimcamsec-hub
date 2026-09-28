import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { deleteResourceAction, togglePublishAction } from "@/actions/admin";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Pagination } from "@/components/resources/Pagination";
import { EducatorBadge, TypeBadge } from "@/components/resources/ResourceMeta";
import { getTier } from "@/lib/curriculum";
import { formatDate } from "@/lib/dates";
import { formatBytes } from "@/lib/format";
import { requireAdmin } from "@/server/auth/guards";
import { ADMIN_RESOURCES_PAGE_SIZE, listAllResources } from "@/server/services/admin-resources";

export const metadata = { title: "Content" };

type SearchParams = Promise<{ page?: string; created?: string }>;

export default async function AdminResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { rows, total } = await listAllResources(page);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Content ({total})</h1>
        <Link href="/admin/resources/new" className="btn-primary">
          <Plus aria-hidden className="size-4" /> Upload resource
        </Link>
      </div>

      {params.created && (
        <p role="status" className="rounded-lg bg-heritage-50 p-3 text-sm text-heritage-900 dark:bg-heritage-950 dark:text-heritage-100">
          Resource uploaded. <Link href={`/resources/${params.created}`} className="underline">View it</Link>
        </p>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500 uppercase dark:border-stone-800 dark:bg-stone-900">
            <tr>
              <th scope="col" className="p-3">Title</th>
              <th scope="col" className="p-3">Tier</th>
              <th scope="col" className="p-3">File</th>
              <th scope="col" className="p-3 text-right">Downloads</th>
              <th scope="col" className="p-3">Status</th>
              <th scope="col" className="p-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="p-3">
                  <Link href={`/resources/${r.slug}`} className="font-medium hover:underline">{r.title}</Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <TypeBadge type={r.resourceType} />
                    {r.audience === "educator" && <EducatorBadge />}
                  </div>
                </td>
                <td className="p-3 whitespace-nowrap">{getTier(r.tier)?.title ?? r.tier}</td>
                <td className="p-3 whitespace-nowrap text-stone-600 dark:text-stone-400">
                  {formatBytes(r.fileSizeBytes)} · {r.pageCount}p
                  {!r.previewKey && <span className="block text-xs text-gold-700">No guest preview</span>}
                  <span className="block text-xs">{formatDate(r.createdAt)}</span>
                </td>
                <td className="p-3 text-right tabular-nums">{r.downloadCount.toLocaleString("en-ZW")}</td>
                <td className="p-3">
                  {r.isPublished ? (
                    <span className="badge bg-heritage-100 text-heritage-800 dark:bg-heritage-900 dark:text-heritage-100">Published</span>
                  ) : (
                    <span className="badge bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300">Hidden</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <form action={togglePublishAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="publish" value={String(!r.isPublished)} />
                      <button type="submit" className="btn-ghost min-h-9 px-2.5" aria-label={r.isPublished ? `Hide ${r.title}` : `Publish ${r.title}`} title={r.isPublished ? "Hide" : "Publish"}>
                        {r.isPublished ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                      </button>
                    </form>
                    <form action={deleteResourceAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="confirm" value="yes" />
                      <ConfirmButton
                        message={`Permanently delete “${r.title}”? Its download history will also be removed.`}
                        className="btn-ghost min-h-9 px-2.5 text-red-700"
                      >
                        <Trash2 aria-hidden className="size-4" />
                        <span className="sr-only">Delete {r.title}</span>
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination base="/admin/resources" params={{}} page={page} pageCount={Math.ceil(total / ADMIN_RESOURCES_PAGE_SIZE)} />
    </div>
  );
}
