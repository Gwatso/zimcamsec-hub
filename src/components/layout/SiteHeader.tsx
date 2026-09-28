import { BadgeCheck, Menu, Search, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import type { SessionUser } from "@/server/auth/session";
import type { Theme } from "@/server/preferences";
import { DataSaverToggle } from "./DataSaverToggle";
import { LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/curriculum", label: "Curriculum" },
  { href: "/resources", label: "Resources" },
  { href: "/resources?type=past-paper", label: "Past Papers" },
  { href: "/curriculum/policy", label: "Policy Hub" },
  { href: "/support", label: "Help & Support" },
  { href: "/about", label: "About" },
];

export function SiteHeader({ user, dataSaver, theme }: { user: SessionUser | null; dataSaver: boolean; theme: Theme }) {
  return (
    <header className="border-b-4 border-gold-500 bg-heritage-700 text-white dark:bg-heritage-900">
      <div className="container-page flex h-16 items-center gap-2 sm:gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Zimcamsec Hub home">
          <LogoMark className="size-8 sm:size-9" />
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight sm:text-base">Zimcamsec Hub</span>
            <span className="hidden text-[11px] text-heritage-100 sm:block">Heritage-Based Curriculum Portal</span>
          </span>
        </Link>

        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 xl:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-white/10">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <Link href="/resources" className="btn hidden min-h-9 px-2.5 py-1.5 hover:bg-white/10 sm:inline-flex" aria-label="Search resources">
            <Search aria-hidden className="size-4" />
          </Link>
          <div className="hidden sm:block">
            <DataSaverToggle enabled={dataSaver} />
          </div>
          <div className="sm:hidden">
            <DataSaverToggle enabled={dataSaver} compact />
          </div>
          <div className="hidden sm:block">
            <ThemeToggle initial={theme} />
          </div>

          {user ? (
            <>
              {user.role === "admin" && (
                <Link href="/admin" className="btn hidden min-h-9 px-3 py-1.5 text-xs hover:bg-white/10 md:inline-flex">
                  <ShieldCheck aria-hidden className="size-4" /> Admin
                </Link>
              )}
              <Link
                href="/account"
                className="btn min-h-9 bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
                aria-label={`My account (${user.firstName})`}
              >
                {user.role === "teacher" && user.teacherStatus === "verified" ? (
                  <BadgeCheck aria-hidden className="size-4 text-gold-300" />
                ) : (
                  <UserRound aria-hidden className="size-4" />
                )}
                <span className="hidden max-w-28 truncate md:inline">{user.firstName}</span>
              </Link>
            </>
          ) : (
            <Link href="/auth/sign-in" className="btn-gold min-h-9 px-3 py-1.5 text-xs whitespace-nowrap">
              Sign in
            </Link>
          )}

          {/* <details> gives a working menu without any JavaScript. */}
          <details className="group relative xl:hidden">
            <summary className="btn min-h-9 cursor-pointer list-none px-2.5 py-1.5 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
              <Menu aria-hidden className="size-5" />
              <span className="sr-only">Menu</span>
            </summary>
            <nav
              aria-label="Mobile"
              className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-stone-200 bg-white p-2 text-stone-900 shadow-xl dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            >
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-heritage-50 dark:hover:bg-stone-800">
                  {item.label}
                </Link>
              ))}
              {user?.role === "admin" && (
                <Link href="/admin" className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-heritage-50 dark:hover:bg-stone-800">
                  Master Admin
                </Link>
              )}
              <Link href="/offline" className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-heritage-50 dark:hover:bg-stone-800">
                Saved offline
              </Link>
              {/* Controls that don't fit the top bar on small phones. */}
              <div className="mt-1 flex items-center justify-between rounded-md bg-heritage-700 px-3 py-2 text-sm font-medium text-white sm:hidden">
                Theme <ThemeToggle initial={theme} />
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
