"use client";

import { AlertTriangle, BookOpen, Loader2, LogIn, WifiOff } from "lucide-react";
import Link from "next/link";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { refreshSoon } from "@/lib/client/live-counts";
import { getOfflineBytes } from "@/lib/client/offline-docs";
import { reportClientError } from "@/lib/client/telemetry";
import { useAppContext } from "../providers/AppProviders";

type Status = "idle" | "loading" | "ready" | "error";

interface Props {
  resourceId: string;
  /** Preview (guest) or full-document URL. */
  src: string;
  /** Pages in the complete document. */
  totalPages: number;
  /** Guest page cap, or null when the viewer may show everything. */
  previewLimit: number | null;
  signInHref: string;
  registerHref: string;
  /** Try the device's "saved offline" copy before the network. */
  preferOfflineCopy: boolean;
}

/** Converts pdf.js / network failures into something a learner can act on. */
function describeError(error: unknown): { message: string; offline?: boolean } {
  const status = (error as { status?: number })?.status;
  if (status === 401) return { message: "Please sign in to read this document." };
  if (status === 403) return { message: "This document is available to verified educators only." };
  if (status === 404) return { message: "This document isn't available right now." };
  if (status === 429) return { message: "Too many requests — please wait a minute and try again." };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { message: "You're offline and this document isn't saved on this device.", offline: true };
  }
  const name = (error as { name?: string })?.name;
  if (name === "InvalidPDFException") return { message: "This file appears to be damaged. Please report it via Help & Support." };
  return { message: "The document couldn't be loaded. Check your connection and try again." };
}

export function PdfViewer(props: Props) {
  const { dataSaver } = useAppContext();
  // In Data-Saver mode nothing is fetched until the user asks for it.
  const [started, setStarted] = useState(!dataSaver);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>(started ? "loading" : "idle");
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<{ message: string; offline?: boolean } | null>(null);
  const [fromDevice, setFromDevice] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    setStatus("loading");
    let task: PDFDocumentLoadingTask | null = null;

    (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const offline = props.preferOfflineCopy ? await getOfflineBytes(props.resourceId).catch(() => null) : null;
      if (cancelled) return;
      setFromDevice(!!offline);

      task = pdfjs.getDocument(
        offline
          ? { data: offline, isEvalSupported: false }
          : {
              url: props.src,
              withCredentials: true,
              isEvalSupported: false,
              // Fetch only the byte ranges needed for pages actually rendered.
              disableAutoFetch: true,
              disableStream: true,
              rangeChunkSize: 65_536,
            },
      );
      const loaded = await task.promise;
      if (cancelled) {
        void loaded.destroy();
        return;
      }
      setDoc(loaded);
      setStatus("ready");
      if (!offline && props.previewLimit === null) refreshSoon(props.resourceId);
    })().catch((err: unknown) => {
      if (cancelled) return;
      const described = describeError(err);
      setError(described);
      setStatus("error");
      if (!described.offline && !(err as { status?: number })?.status) reportClientError("error", err);
    });

    // Unmount / retry: destroying the loading task also destroys its document and worker resources.
    return () => {
      cancelled = true;
      void task?.destroy();
    };
    // `attempt` re-runs loading after "Try again".
  }, [started, attempt, props.src, props.resourceId, props.preferOfflineCopy, props.previewLimit]);

  const shownPages = doc?.numPages ?? 0;
  const gated = props.previewLimit !== null && props.totalPages > props.previewLimit;

  return (
    <section aria-label="Document preview" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-sm dark:border-stone-800 dark:bg-stone-900">
        <span className="flex items-center gap-2 font-medium">
          <BookOpen aria-hidden className="size-4 text-heritage-600" />
          {gated ? `Free preview · ${Math.min(props.previewLimit ?? 0, props.totalPages)} of ${props.totalPages} pages` : `${props.totalPages} pages`}
        </span>
        {fromDevice && <span className="badge bg-heritage-100 text-heritage-800 dark:bg-heritage-900 dark:text-heritage-200">Opened from this device</span>}
      </div>

      <div ref={containerRef} className="bg-stone-200/70 p-2 sm:p-4 dark:bg-stone-950">
        {status === "idle" && (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <p className="max-w-sm text-sm text-stone-700 dark:text-stone-300">
              Data-Saver is on. The preview loads only when you ask, and only the pages you scroll to are downloaded.
            </p>
            <button type="button" className="btn-primary" onClick={() => setStarted(true)}>
              Load preview
            </button>
          </div>
        )}

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-stone-600 dark:text-stone-400" role="status">
            <Loader2 aria-hidden className="size-5 animate-spin" /> Loading document…
          </div>
        )}

        {status === "error" && error && (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center" role="alert">
            {error.offline ? <WifiOff aria-hidden className="size-8 text-stone-500" /> : <AlertTriangle aria-hidden className="size-8 text-gold-600" />}
            <p className="max-w-sm text-sm">{error.message}</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setError(null);
                setDoc(null);
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}

        {status === "ready" && doc && width > 0 && (
          <ol className="mx-auto flex max-w-3xl flex-col gap-3 sm:gap-4">
            {Array.from({ length: shownPages }, (_, i) => (
              <li key={i}>
                <PdfPage doc={doc} pageNumber={i + 1} width={Math.min(width, 768)} dataSaver={dataSaver} />
              </li>
            ))}
          </ol>
        )}

        {status === "ready" && gated && (
          <div className="mx-auto mt-4 max-w-3xl rounded-xl border-2 border-dashed border-gold-500 bg-white p-6 text-center dark:bg-stone-900">
            <h3 className="text-lg font-semibold">That&apos;s the end of the free preview</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-stone-600 dark:text-stone-400">
              Sign in or create a free account to read all {props.totalPages} pages, download the PDF and save it for offline study.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href={props.signInHref} className="btn-primary">
                <LogIn aria-hidden className="size-4" /> Sign in
              </Link>
              <Link href={props.registerHref} className="btn-gold">
                Create free account
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PdfPage({ doc, pageNumber, width, dataSaver }: { doc: PDFDocumentProxy; pageNumber: number; width: number; dataSaver: boolean }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNumber === 1);
  const [height, setHeight] = useState(Math.round(width * 1.414)); // A4 estimate until measured

  // Render only pages near the viewport: saves CPU, memory and (with range requests) data.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const cssScale = width / base.width;
      const dpr = Math.min(window.devicePixelRatio || 1, dataSaver ? 1 : 1.5);
      const viewport = page.getViewport({ scale: cssScale * dpr });
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
      setHeight(Math.floor(viewport.height / dpr));
      renderTask = page.render({ canvasContext: context, viewport });
      await renderTask.promise;
    })().catch((err: unknown) => {
      if ((err as { name?: string })?.name !== "RenderingCancelledException" && !cancelled) {
        reportClientError("error", err);
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNumber, width, visible, dataSaver]);

  return (
    <div ref={wrapperRef} className="mx-auto bg-white shadow" style={{ width, minHeight: height }}>
      <canvas ref={canvasRef} role="img" aria-label={`Page ${pageNumber}`} className="block" />
    </div>
  );
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const padding = () => {
      const style = getComputedStyle(el);
      return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    };
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      // Round to 16px steps so tiny resizes (mobile URL bar) don't re-render every page.
      frame = requestAnimationFrame(() => setWidth(Math.floor((el.clientWidth - padding()) / 16) * 16));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ref]);
  return width;
}
