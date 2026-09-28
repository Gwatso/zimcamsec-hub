"use client";

import { createContext, useContext, useEffect } from "react";
import { setPollingEnabled } from "@/lib/client/live-counts";
import { flushTelemetry, reportClientError } from "@/lib/client/telemetry";

interface AppContextValue {
  dataSaver: boolean;
  signedIn: boolean;
}

const AppContext = createContext<AppContextValue>({ dataSaver: false, signedIn: false });

export function useAppContext() {
  return useContext(AppContext);
}

/**
 * Client-side app wiring that must exist exactly once:
 *  - exposes server-resolved preferences to client components,
 *  - installs global error handlers (→ /api/telemetry → admin logs),
 *  - registers the service worker (production only),
 *  - pauses live-counter polling in Data-Saver mode.
 */
export function AppProviders({ dataSaver, signedIn, children }: AppContextValue & { children: React.ReactNode }) {
  useEffect(() => {
    setPollingEnabled(!dataSaver);
  }, [dataSaver]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => reportClientError("error", event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => reportClientError("unhandledrejection", event.reason);
    const onOnline = () => flushTelemetry();
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("online", onOnline);
    flushTelemetry(); // Send anything buffered while offline on a previous visit.
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return <AppContext.Provider value={{ dataSaver, signedIn }}>{children}</AppContext.Provider>;
}
