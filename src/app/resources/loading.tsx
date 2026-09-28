/** Lightweight skeleton shown during client-side navigation between catalogue pages. */
export default function Loading() {
  return (
    <div className="container-page py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading resources…</span>
      <div className="h-9 w-48 animate-pulse rounded bg-stone-200 dark:bg-stone-800" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="h-96 animate-pulse rounded-xl bg-stone-200 dark:bg-stone-800" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-stone-200 dark:bg-stone-800" />
          ))}
        </div>
      </div>
    </div>
  );
}
