import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <FileQuestion aria-hidden className="size-14 text-heritage-600" />
      <h1 className="mt-4 text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-stone-600 dark:text-stone-400">
        The link may be old, or the resource may have been moved or removed.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/resources" className="btn-primary">Search resources</Link>
        <Link href="/" className="btn-secondary">Go home</Link>
      </div>
    </div>
  );
}
