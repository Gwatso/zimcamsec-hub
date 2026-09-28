import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/SignInForm";
import { safeNextPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

type SearchParams = Promise<{ next?: string; signedOut?: string }>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(params.next, "/account");
  if (await getCurrentUser()) redirect(next);

  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-stone-600 dark:text-stone-400">Sign in to download resources, read full documents and save them offline.</p>
        {params.signedOut === "all" && (
          <p role="status" className="mt-4 rounded-lg bg-heritage-50 p-3 text-sm text-heritage-900 dark:bg-heritage-950 dark:text-heritage-100">
            You&apos;ve been signed out on all devices.
          </p>
        )}
        <div className="card mt-6 p-6">
          <SignInForm next={next} />
        </div>
      </div>
    </div>
  );
}
