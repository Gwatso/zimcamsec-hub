import { Activity, FileStack, Inbox, LayoutDashboard, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = { title: { default: "Master Admin", template: "%s · Master Admin" }, robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/resources", label: "Content", icon: FileStack },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/support", label: "Support desk", icon: Inbox },
  { href: "/admin/logs", label: "System logs", icon: Activity },
];

/** UX shell only. Every admin page and Server Action re-checks requireAdmin() itself. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="container-page py-8">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Admin" className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 px-3 text-xs font-bold tracking-wider text-gold-700 uppercase dark:text-gold-400">Master Admin</p>
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap hover:bg-stone-100 dark:hover:bg-stone-800">
                  <Icon aria-hidden className="size-4 text-heritage-600" /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
