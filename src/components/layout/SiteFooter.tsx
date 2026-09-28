import { Mail } from "lucide-react";
import Link from "next/link";
import { TIERS } from "@/lib/curriculum";
import { getEnv } from "@/server/env";
import { LogoMark } from "./Logo";

export function SiteFooter() {
  const SUPPORT_EMAIL = getEnv().SUPPORT_INBOX;
  return (
    <footer className="mt-16 border-t-4 border-gold-500 bg-heritage-950 text-heritage-100">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-lg font-bold text-white">Zimcamsec Hub</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-heritage-200">
            Free, fast and offline-friendly learning resources for Zimbabwe&apos;s learners and educators — ECD A to Form 6.
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-4 inline-flex items-center gap-2 text-sm text-gold-300 hover:underline">
            <Mail aria-hidden className="size-4" /> {SUPPORT_EMAIL}
          </a>
        </div>

        <nav aria-label="Curriculum tiers">
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">Curriculum</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {TIERS.map((t) => (
              <li key={t.slug}>
                <Link href={`/curriculum/${t.slug}`} className="hover:text-white hover:underline">
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Platform">
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">Platform</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/resources" className="hover:text-white hover:underline">Browse all resources</Link></li>
            <li><Link href="/auth/register" className="hover:text-white hover:underline">Create an account</Link></li>
            <li><Link href="/offline" className="hover:text-white hover:underline">Saved offline</Link></li>
            <li><Link href="/support" className="hover:text-white hover:underline">Help &amp; Support</Link></li>
            <li><Link href="/about" className="hover:text-white hover:underline">Mission &amp; values</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">Disclaimer</h2>
          <p className="mt-3 text-xs leading-relaxed text-heritage-300">
            Zimcamsec Hub is an independent, unofficial platform that indexes and compiles publicly circulated educational
            documents. It is <strong>not</strong> affiliated with, endorsed by, or connected to any National Examination Board,
            Ministry of Education (including MoPSE), Cambridge International Education, textbook publishers or specific schools.
            All resources are aggregated from open public channels. Rights holders may request removal via{" "}
            <Link href="/support?category=copyright" className="underline">Help &amp; Support</Link>.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-4 text-xs text-heritage-300">
          &copy; 2026 Zimcamsec Hub. All rights reserved. Support: {SUPPORT_EMAIL}
        </p>
      </div>
    </footer>
  );
}
