"use client";

import { BadgeCheck, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAction } from "@/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/forms/Field";
import { LEARNER_LEVELS } from "@/lib/curriculum";
import { ageOn, harareDate } from "@/lib/dates";
import { initialFormState } from "@/lib/form-state";
import { cn } from "@/lib/format";
import { GUARDIAN_REQUIRED_UNDER, LEARNER_MAX_AGE } from "@/lib/validation";

type Role = "learner" | "teacher";

export function RegisterForm({ next, initialRole }: { next: string; initialRole: Role }) {
  const [state, action] = useActionState(registerAction, initialFormState);
  const [role, setRole] = useState<Role>((state.values?.role as Role | undefined) ?? initialRole);
  const [dob, setDob] = useState(state.values?.dateOfBirth ?? "");
  const age = dob ? ageOn(dob, harareDate()) : null;
  const needsGuardian = role === "learner" && age !== null && age < GUARDIAN_REQUIRED_UNDER;

  const tiers = [...new Set(LEARNER_LEVELS.map((l) => l.tierTitle))];

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />

      <fieldset>
        <legend className="field-label">I am a…</legend>
        <div className="grid grid-cols-2 gap-3">
          <RoleOption
            value="learner"
            checked={role === "learner"}
            onSelect={setRole}
            icon={<GraduationCap aria-hidden className="size-5" />}
            title="Learner"
            text={`${LEARNER_MAX_AGE} years and under`}
          />
          <RoleOption
            value="teacher"
            checked={role === "teacher"}
            onSelect={setRole}
            icon={<BadgeCheck aria-hidden className="size-5" />}
            title="Teacher"
            text="Verified educator"
          />
        </div>
        {state.errors?.role && <p className="field-error">{state.errors.role}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="firstName" label="First name" autoComplete="given-name" required maxLength={60} state={state} />
        <Field name="surname" label="Surname" autoComplete="family-name" required maxLength={60} state={state} />
      </div>
      <Field name="email" label="E-mail address" type="email" autoComplete="email" inputMode="email" required state={state} />

      {role === "learner" ? (
        <div className="space-y-4 rounded-xl bg-heritage-50 p-4 dark:bg-heritage-950/40">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="dateOfBirth"
              label="Date of birth"
              type="date"
              required
              max={harareDate()}
              state={state}
              onChange={(e) => setDob(e.currentTarget.value)}
              hint={`Learner accounts are for ages ${LEARNER_MAX_AGE} and under.`}
            />
            <Field name="gradeLevel" label="Grade / Form" as="select" required state={state}>
              <option value="" disabled>
                Choose…
              </option>
              {tiers.map((tier) => (
                <optgroup key={tier} label={tier}>
                  {LEARNER_LEVELS.filter((l) => l.tierTitle === tier).map((l) => (
                    <option key={l.level.slug} value={l.level.slug}>
                      {l.level.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Field>
          </div>
          {(needsGuardian || state.errors?.guardianEmail) && (
            <Field
              name="guardianEmail"
              label="Parent or guardian e-mail"
              type="email"
              inputMode="email"
              required
              state={state}
              hint={`Required for learners under ${GUARDIAN_REQUIRED_UNDER}. We only use it for account safety notices.`}
            />
          )}
          {age !== null && age > LEARNER_MAX_AGE && (
            <p className="text-sm text-gold-800 dark:text-gold-200" role="status">
              You&apos;re over {LEARNER_MAX_AGE}. If you&apos;re an educator, choose <strong>Teacher</strong> above.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-xl bg-gold-50 p-4 dark:bg-gold-900/20">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="ecNumber"
              label="EC Number"
              required
              autoCapitalize="characters"
              placeholder="1234567A"
              maxLength={12}
              state={state}
              hint="Your Employment Code, used to verify you as an educator."
            />
            <Field name="schoolName" label="School name" required maxLength={120} autoComplete="organization" state={state} />
          </div>
          <p className="text-sm text-stone-700 dark:text-stone-300">
            You can use learner resources straight away. Schemes of work, teacher syllabi and administrative circulars unlock
            once our team verifies your details — usually within 2 working days.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="password" label="Password" type="password" autoComplete="new-password" required minLength={8} state={state} hint="At least 8 characters." />
        <Field name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" required state={state} />
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acceptTerms" className="mt-1 size-4 accent-heritage-600" required defaultChecked={state.values?.acceptTerms === "on"} />
          <span>
            I agree to use Zimcamsec Hub responsibly and understand it is an independent platform, not affiliated with MoPSE or
            any examination board. {role === "learner" && "My parent or guardian knows I am creating this account."}
          </span>
        </label>
        {state.errors?.acceptTerms && <p className="field-error">{state.errors.acceptTerms}</p>}
      </div>

      <SubmitButton pendingText="Creating your account…">Create free account</SubmitButton>
      <p className="text-center text-sm text-stone-600 dark:text-stone-400">
        Already registered?{" "}
        <Link href={`/auth/sign-in?next=${encodeURIComponent(next)}`} className="font-semibold text-heritage-700 hover:underline dark:text-heritage-300">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function RoleOption({
  value,
  checked,
  onSelect,
  icon,
  title,
  text,
}: {
  value: Role;
  checked: boolean;
  onSelect: (role: Role) => void;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-colors",
        checked ? "border-heritage-600 bg-heritage-50 dark:bg-heritage-950" : "border-stone-200 hover:border-stone-300 dark:border-stone-700",
      )}
    >
      <input type="radio" name="role" value={value} checked={checked} onChange={() => onSelect(value)} className="sr-only" />
      <span className="flex items-center gap-2 font-semibold">
        {icon} {title}
      </span>
      <span className="text-xs text-stone-600 dark:text-stone-400">{text}</span>
    </label>
  );
}
