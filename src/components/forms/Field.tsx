"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form-state";
import { cn } from "@/lib/format";

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "name"> {
  name: string;
  label: string;
  state: FormState;
  hint?: React.ReactNode;
  as?: "input" | "textarea" | "select";
  children?: React.ReactNode;
  rows?: number;
}

/** Labelled input wired to a FormState: shows its error and restores its value after a failed submit. */
export function Field({ name, label, state, hint, as = "input", children, className, defaultValue, ...rest }: FieldProps) {
  const id = `field-${name}`;
  const error = state.errors?.[name];
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const value = state.values?.[name] ?? defaultValue;
  const common = {
    id,
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: cn("field-input", className),
  };

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {rest.required && <span aria-hidden className="text-red-700"> *</span>}
      </label>
      {as === "textarea" ? (
        <textarea
          {...common}
          rows={rest.rows ?? 5}
          defaultValue={value as string | undefined}
          required={rest.required}
          maxLength={rest.maxLength}
          minLength={rest.minLength}
          placeholder={rest.placeholder}
        />
      ) : as === "select" ? (
        <select
          {...common}
          // React applies a <select>'s defaultValue only on mount, and resets forms after an
          // action; remounting on the echoed value keeps the user's choice after a failed submit.
          key={String(value ?? "")}
          defaultValue={(value as string | undefined) ?? ""}
          required={rest.required}
          disabled={rest.disabled}
          onChange={rest.onChange as unknown as React.ChangeEventHandler<HTMLSelectElement>}
        >
          {children}
        </select>
      ) : (
        <input {...rest} {...common} defaultValue={value} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  const success = state.status === "success";
  return (
    <div
      role={success ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-lg p-3 text-sm",
        success
          ? "bg-heritage-50 text-heritage-900 dark:bg-heritage-950 dark:text-heritage-100"
          : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
      )}
    >
      {success ? <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" /> : <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />}
      <span>{state.message}</span>
    </div>
  );
}

export function SubmitButton({ children, pendingText, className }: { children: React.ReactNode; pendingText: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={className ?? "btn-primary w-full"}>
      {pending ? pendingText : children}
    </button>
  );
}
