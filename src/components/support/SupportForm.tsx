"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { useActionState } from "react";
import { submitSupportAction } from "@/actions/support";
import { Field, FormMessage, SubmitButton } from "@/components/forms/Field";
import { initialFormState } from "@/lib/form-state";
import { SUPPORT_CATEGORIES } from "@/lib/validation";

export function SupportForm({
  defaults,
  inbox,
}: {
  defaults: { firstName?: string; surname?: string; email?: string; category?: string };
  inbox: string;
}) {
  const [state, action] = useActionState(submitSupportAction, initialFormState);

  if (state.status === "success") {
    const delivered = state.data?.delivery === "sent";
    return (
      <div className="card p-6 text-center sm:p-10" role="status">
        {delivered ? (
          <CheckCircle2 aria-hidden className="mx-auto size-12 text-heritage-600" />
        ) : (
          <Clock aria-hidden className="mx-auto size-12 text-gold-600" />
        )}
        <h2 className="mt-4 text-xl font-bold">Message received</h2>
        <p className="mt-2 text-stone-700 dark:text-stone-300">
          Your reference number is{" "}
          <strong className="rounded bg-gold-100 px-2 py-0.5 font-mono text-heritage-950">{state.data?.reference}</strong>
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-stone-600 dark:text-stone-400">
          {delivered
            ? `Your message has been delivered to ${state.data?.inbox ?? inbox}. We'll reply to the e-mail address you provided.`
            : `Your message is safely logged in our support queue and will be forwarded to ${state.data?.inbox ?? inbox}. We'll reply to the e-mail address you provided.`}
        </p>
        <p className="mt-2 text-xs text-stone-500">Please quote your reference if you contact us again.</p>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="firstName" label="First name" required autoComplete="given-name" maxLength={60} defaultValue={defaults.firstName} state={state} />
        <Field name="surname" label="Surname" required autoComplete="family-name" maxLength={60} defaultValue={defaults.surname} state={state} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="email" label="E-mail address" type="email" inputMode="email" required autoComplete="email" defaultValue={defaults.email} state={state} />
        <Field name="phone" label="Phone number (optional)" type="tel" inputMode="tel" autoComplete="tel" placeholder="+263 77 123 4567" state={state} />
      </div>
      <Field name="category" label="Subject / challenge category" as="select" required defaultValue={defaults.category ?? ""} state={state}>
        <option value="" disabled>
          Choose a subject…
        </option>
        {SUPPORT_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Field>
      <Field
        name="message"
        label="Message / details"
        as="textarea"
        required
        rows={6}
        minLength={20}
        maxLength={5000}
        placeholder="Tell us what happened, which resource or page it was on, and what device you're using."
        state={state}
      />
      {/* Honeypot — hidden from people and assistive tech. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <SubmitButton pendingText="Sending…" className="btn-primary w-full sm:w-auto">
        Send message
      </SubmitButton>
      <p className="text-xs text-stone-500">
        Messages go to <strong>{inbox}</strong>. Please don&apos;t include passwords. Learners: avoid sharing your home address.
      </p>
    </form>
  );
}
