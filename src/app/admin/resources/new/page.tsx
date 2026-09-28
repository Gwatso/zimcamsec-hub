import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ResourceUploadForm } from "@/components/admin/ResourceUploadForm";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Upload resource" };

export default async function NewResourcePage() {
  await requireAdmin();
  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/resources" className="btn-ghost -ml-2">
        <ArrowLeft aria-hidden className="size-4" /> Content
      </Link>
      <h1 className="text-2xl font-bold">Upload resource</h1>
      <p className="text-sm text-stone-600 dark:text-stone-400">
        Only upload publicly circulated documents you are entitled to share. Official-looking material must remain clearly
        attributed to its source.
      </p>
      <ResourceUploadForm />
    </div>
  );
}
