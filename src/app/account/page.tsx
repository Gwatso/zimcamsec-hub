import { BadgeCheck, Clock, GraduationCap, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { OfflineLibrary } from "@/components/resources/ResourceActions";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { levelLabel } from "@/lib/curriculum";
import { ageOn, formatDate } from "@/lib/dates";
import { LEARNER_MAX_AGE } from "@/lib/validation";
import { requireUser } from "@/server/auth/guards";
import { getPreferences } from "@/server/preferences";
import { getUserHistory } from "@/server/services/downloads";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

type SearchParams = Promise<{ welcome?: string }>;

export default async function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/account");
  const [history, prefs, params] = await Promise.all([getUserHistory(user.id), getPreferences(), searchParams]);
  const age = user.dateOfBirth ? ageOn(user.dateOfBirth) : null;

  return (
    <div className="container-page py-8">
      {params.welcome && (
        <div role="status" className="mb-6 rounded-xl bg-heritage-50 p-4 text-heritage-900 dark:bg-heritage-950 dark:text-heritage-100">
          <strong>Welcome to Zimcamsec Hub, {user.firstName}!</strong>{" "}
          <Link href="/resources" className="underline">Start browsing resources</Link>
          {user.role === "teacher" && " — your teacher verification request has been sent to our team."}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="card p-5">
            <h1 className="text-xl font-bold">
              {user.firstName} {user.surname}
            </h1>
            <p className="text-sm break-all text-stone-600 dark:text-stone-400">{user.email}</p>
            <div className="mt-3">
              <RoleBadge role={user.role} teacherStatus={user.teacherStatus} />
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              {user.role === "learner" && (
                <>
                  <Row label="Grade / Form" value={levelLabel(user.gradeLevel) ?? "—"} />
                  <Row label="Age group" value={`${LEARNER_MAX_AGE} and under`} />
                </>
              )}
              {user.role === "teacher" && (
                <>
                  <Row label="EC Number" value={user.ecNumber ?? "—"} />
                  <Row label="School" value={user.schoolName ?? "—"} />
                </>
              )}
              <Row label="Member since" value={formatDate(user.createdAt)} />
            </dl>
            {user.role === "learner" && age !== null && age > LEARNER_MAX_AGE && (
              <p className="mt-3 rounded-lg bg-gold-50 p-2 text-xs text-gold-900 dark:bg-gold-900/30 dark:text-gold-100">
                You&apos;re now over {LEARNER_MAX_AGE}. Your learner access continues; if you&apos;ve become an educator,{" "}
                <Link href="/support?category=account" className="underline">ask us to convert your account</Link>.
              </p>
            )}
          </div>
          <div className="card space-y-1 p-3">
            <SignOutButton className="btn-ghost w-full justify-start" />
            <SignOutButton everywhere className="btn-ghost w-full justify-start" />
          </div>
        </aside>

        <div className="min-w-0 space-y-10">
          <section aria-labelledby="offline-heading">
            <h2 id="offline-heading" className="mb-3 text-lg font-bold">Saved on this device</h2>
            <OfflineLibrary emptyHint={<>Use <strong>Save for offline</strong> on any resource to read it without a connection.</>} />
          </section>

          <section aria-labelledby="history-heading">
            <h2 id="history-heading" className="mb-3 text-lg font-bold">Recently opened &amp; downloaded</h2>
            {history.length === 0 ? (
              <div className="card p-6 text-sm text-stone-600 dark:text-stone-400">
                Nothing yet. <Link href="/resources" className="font-semibold text-heritage-700 underline dark:text-heritage-300">Browse resources</Link> to get started.
              </div>
            ) : (
              <ul className="space-y-3">
                {history.map((r) => (
                  <ResourceCard key={r.id} resource={r} view="list" dataSaver={prefs.dataSaver} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function RoleBadge({ role, teacherStatus }: { role: string; teacherStatus: string | null }) {
  if (role === "admin") {
    return <span className="badge bg-heritage-900 text-gold-200"><ShieldCheck aria-hidden className="size-3.5" /> Master Admin</span>;
  }
  if (role === "learner") {
    return <span className="badge bg-heritage-100 text-heritage-800 dark:bg-heritage-900 dark:text-heritage-100"><GraduationCap aria-hidden className="size-3.5" /> Learner</span>;
  }
  if (teacherStatus === "verified") {
    return <span className="badge bg-gold-500 text-heritage-950"><BadgeCheck aria-hidden className="size-3.5" /> Verified Teacher</span>;
  }
  if (teacherStatus === "rejected") {
    return <span className="badge bg-red-100 text-red-900"><ShieldAlert aria-hidden className="size-3.5" /> Verification unsuccessful</span>;
  }
  return <span className="badge bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200"><Clock aria-hidden className="size-3.5" /> Teacher · verification pending</span>;
}
