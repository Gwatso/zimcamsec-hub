import type { Metadata, Viewport } from "next";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AppProviders } from "@/components/providers/AppProviders";
import { getCurrentUser } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { getPreferences } from "@/server/preferences";
import "./globals.css";

// Every page depends on the session / preference cookies, so skip build-time
// prerendering entirely (it would otherwise open a database connection in CI).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(getEnv().APP_URL),
  title: {
    default: "Zimcamsec Hub — Heritage-Based Curriculum Resources",
    template: "%s · Zimcamsec Hub",
  },
  description:
    "Free past papers, specimen papers, study notes, schemes of work and Ministry circulars for Zimbabwe's Heritage-Based Curriculum, ECD A to Form 6. Works offline and on low data.",
  applicationName: "Zimcamsec Hub",
  openGraph: { type: "website", siteName: "Zimcamsec Hub", locale: "en_ZW" },
  icons: { icon: "/icon.svg" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3f6135" },
    { media: "(prefers-color-scheme: dark)", color: "#2c4127" },
  ],
  width: "device-width",
  initialScale: 1,
};

/** Applies the OS theme before first paint when the user hasn't chosen one (prevents a flash). */
const systemThemeScript = `try{if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, prefs] = await Promise.all([getCurrentUser(), getPreferences()]);

  return (
    <html
      lang="en"
      className={prefs.theme === "dark" ? "dark" : undefined}
      data-saver={prefs.dataSaver ? "on" : "off"}
      suppressHydrationWarning
    >
      <head>{prefs.theme === "system" && <script dangerouslySetInnerHTML={{ __html: systemThemeScript }} />}</head>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:p-2 focus:text-black">
          Skip to content
        </a>
        <AppProviders dataSaver={prefs.dataSaver} signedIn={!!user}>
          <OfflineBanner />
          <SiteHeader user={user} dataSaver={prefs.dataSaver} theme={prefs.theme} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
