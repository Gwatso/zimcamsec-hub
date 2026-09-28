import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { safeNextPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

type SearchParams = Promise<{ next?: string; role?: string }>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(params.next, "/account?welcome=1");
  if (await getCurrentUser()) redirect(next);

  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold">Create your free account</h1>
        <p className="mt-1 text-stone-600 dark:text-stone-400">
          Free forever. Download past papers, read full documents and save them to your phone for offline study.
        </p>
        <div className="card mt-6 p-6">
          <RegisterForm next={next} initialRole={params.role === "teacher" ? "teacher" : "learner"} />
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs text-stone-500">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          We collect only what we need. Learner details are never shown publicly or shared, and passwords are stored using
          strong one-way hashing.
        </p>
      </div>
    </div>
  );
}
