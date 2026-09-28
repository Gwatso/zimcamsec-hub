"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createResourceAction } from "@/actions/admin";
import { Field, FormMessage, SubmitButton } from "@/components/forms/Field";
import { EXAM_SESSIONS, RESOURCE_TYPES, TIERS, defaultAudienceFor, getTier, isResourceTypeSlug } from "@/lib/curriculum";
import { initialFormState } from "@/lib/form-state";
import { MAX_COVER_BYTES, MAX_PDF_BYTES } from "@/lib/validation";

export function ResourceUploadForm() {
  const [state, action] = useActionState(createResourceAction, initialFormState);
  const [tier, setTier] = useState(state.values?.tier ?? "");
  const [audience, setAudience] = useState(state.values?.audience ?? "public");
  const [fileError, setFileError] = useState<string | null>(null);
  const tierDef = getTier(tier);

  return (
    <form action={action} className="card space-y-5 p-6" encType="multipart/form-data">
      <FormMessage state={state} />
      {state.data?.duplicateSlug && (
        <p className="text-sm">
          <Link href={`/resources/${state.data.duplicateSlug}`} className="underline">Open the existing resource</Link>
        </p>
      )}

      <div>
        <label htmlFor="file" className="field-label">PDF file <span className="text-red-700">*</span></label>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required
          className="field-input py-2"
          aria-invalid={state.errors?.file || fileError ? true : undefined}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            // Early client-side feedback; the server re-validates everything.
            setFileError(f && f.size > MAX_PDF_BYTES ? `PDF must be ${MAX_PDF_BYTES / 1024 / 1024} MB or smaller` : null);
          }}
        />
        <p className="field-hint">Max {MAX_PDF_BYTES / 1024 / 1024} MB. A 2-page guest preview is generated automatically. Duplicate files are rejected.</p>
        {(fileError || state.errors?.file) && <p className="field-error">{fileError ?? state.errors?.file}</p>}
      </div>

      <Field name="title" label="Title" required maxLength={160} placeholder="e.g. O-Level Mathematics Paper 1 (November 2023)" state={state} />
      <Field name="description" label="Description" as="textarea" rows={3} maxLength={2000} state={state} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="tier" label="Curriculum tier" as="select" required state={state} onChange={(e) => setTier(e.currentTarget.value)}>
          <option value="" disabled>Choose…</option>
          {TIERS.map((t) => <option key={t.slug} value={t.slug}>{t.title}</option>)}
        </Field>
        <Field key={`level-${tier}`} name="level" label="Grade / Form" as="select" state={state} disabled={!tierDef || tierDef.levels.length === 0}>
          <option value="">All levels</option>
          {tierDef?.levels.map((l) => <option key={l.slug} value={l.slug}>{l.label}</option>)}
        </Field>
        <Field key={`subject-${tier}`} name="subject" label="Subject / area" as="select" state={state} disabled={!tierDef}>
          <option value="">General</option>
          {tierDef?.subjects.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="resourceType"
          label="Resource type"
          as="select"
          required
          state={state}
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (isResourceTypeSlug(v)) setAudience(defaultAudienceFor(v));
          }}
        >
          <option value="" disabled>Choose…</option>
          {RESOURCE_TYPES.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
        </Field>
        <fieldset>
          <legend className="field-label">Audience</legend>
          <div className="flex gap-4 pt-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="audience" value="public" checked={audience === "public"} onChange={() => setAudience("public")} className="accent-heritage-600" />
              Everyone (learners &amp; teachers)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="audience" value="educator" checked={audience === "educator"} onChange={() => setAudience("educator")} className="accent-heritage-600" />
              Verified teachers only
            </label>
          </div>
        </fieldset>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="year" label="Year" type="number" min={1980} max={new Date().getFullYear() + 1} inputMode="numeric" state={state} />
        <Field name="examSession" label="Exam session" as="select" state={state}>
          <option value="">—</option>
          {EXAM_SESSIONS.map((s) => <option key={s} value={s}>{s === "june" ? "June" : "November"}</option>)}
        </Field>
        <Field name="paperNumber" label="Paper number" type="number" min={1} max={9} inputMode="numeric" state={state} />
      </div>

      <div>
        <label htmlFor="cover" className="field-label">Cover image (optional)</label>
        <input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="field-input py-2" />
        <p className="field-hint">JPEG, PNG or WebP, max {MAX_COVER_BYTES / 1024} KB. Hidden for Data-Saver users.</p>
        {state.errors?.cover && <p className="field-error">{state.errors.cover}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={state.values ? state.values.isPublished === "on" : true} className="size-4 accent-heritage-600" />
        Publish immediately
      </label>

      <SubmitButton pendingText="Uploading & processing…" className="btn-primary">Upload resource</SubmitButton>
    </form>
  );
}
