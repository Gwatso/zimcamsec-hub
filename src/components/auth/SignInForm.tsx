"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "@/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/forms/Field";
import { initialFormState } from "@/lib/form-state";

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, initialFormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field name="email" label="E-mail address" type="email" autoComplete="email" inputMode="email" required state={state} />
      <Field name="password" label="Password" type="password" autoComplete="current-password" required state={state} />
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm text-stone-600 dark:text-stone-400">
        New here?{" "}
        <Link href={`/auth/register?next=${encodeURIComponent(next)}`} className="font-semibold text-heritage-700 hover:underline dark:text-heritage-300">
          Create a free account
        </Link>
      </p>
      <p className="text-center text-xs text-stone-500">
        Forgot your password? <Link href="/support?category=account" className="underline">Contact support</Link> and we&apos;ll help you back in.
      </p>
    </form>
  );
}
