"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OfflineLibrary } from "@/components/resources/ResourceActions";
import { PdfViewer } from "@/components/viewer/PdfViewer";
import { type OfflineDoc, listOfflineDocs } from "@/lib/client/offline-docs";

export function OfflineReader() {
  const openId = useSearchParams().get("open");
  const [doc, setDoc] = useState<OfflineDoc | null | undefined>(undefined);

  useEffect(() => {
    setDoc(openId ? (listOfflineDocs().find((d) => d.id === openId) ?? null) : null);
  }, [openId]);

  if (doc === undefined) return null; // localStorage is client-only; avoid a hydration mismatch.

  if (doc) {
    return (
      <div className="space-y-4">
        <Link href="/offline" className="btn-ghost -ml-2">
          <ArrowLeft aria-hidden className="size-4" /> All saved documents
        </Link>
        <h2 className="text-xl font-semibold">{doc.title}</h2>
        <PdfViewer
          resourceId={doc.id}
          src={`/api/resources/${doc.id}/file?mode=view`}
          totalPages={doc.pageCount}
          previewLimit={null}
          signInHref={`/auth/sign-in?next=${encodeURIComponent(`/resources/${doc.slug}`)}`}
          registerHref="/auth/register"
          preferOfflineCopy
        />
      </div>
    );
  }

  return (
    <OfflineLibrary
      emptyHint={
        <>
          Nothing saved yet. Open any resource while online and tap <strong>Save for offline</strong>.{" "}
          <Link href="/resources" className="font-semibold text-heritage-700 underline dark:text-heritage-300">
            Browse resources
          </Link>
        </>
      }
    />
  );
}
