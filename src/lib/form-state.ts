/** Shape returned by every form Server Action (consumed via useActionState). */
export interface FormState {
  status: "idle" | "success" | "error";
  message?: string;
  /** Field name -> first error message. */
  errors?: Record<string, string>;
  /** Echoed non-secret values so the form can be re-populated after an error. */
  values?: Record<string, string>;
  /** Action-specific payload (e.g. a ticket reference). */
  data?: Record<string, string>;
}

export const initialFormState: FormState = { status: "idle" };

const SECRET_FIELDS = new Set(["password", "confirmPassword", "website"]);

export function echoValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !SECRET_FIELDS.has(key) && !key.startsWith("$")) out[key] = value.slice(0, 5000);
  }
  return out;
}
