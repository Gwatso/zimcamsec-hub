"use client";

import { SlidersHorizontal } from "lucide-react";
import Form from "next/form";
import { useRef } from "react";
import { RESOURCE_TYPES, TIERS, getTier } from "@/lib/curriculum";
import type { CatalogueQuery } from "@/lib/validation";

/**
 * A GET form — filters live in the URL (shareable, cacheable, back-button
 * friendly, work without JavaScript via the Apply button). With JS, next/form
 * turns submissions into client-side navigations and changes submit automatically.
 */
export function CatalogueFilters({
  action,
  query,
  lockedTier,
  years,
}: {
  action: string;
  query: CatalogueQuery;
  lockedTier?: string;
  years: number[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const tierSlug = lockedTier ?? query.tier;
  const tier = tierSlug ? getTier(tierSlug) : undefined;

  const submit = () => formRef.current?.requestSubmit();
  const onTierChange = () => {
    const form = formRef.current;
    if (!form) return;
    // Level/subject belong to the previous tier — reset them.
    (form.elements.namedItem("level") as HTMLSelectElement | null)?.setAttribute("disabled", "");
    (form.elements.namedItem("subject") as HTMLSelectElement | null)?.setAttribute("disabled", "");
    submit();
  };

  return (
    <Form ref={formRef} action={action} role="search" aria-label="Filter resources" className="card space-y-4 p-4">
      <div>
        <label htmlFor="q" className="field-label">
          Search
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query.q}
          placeholder="e.g. O-Level maths 2023"
          className="field-input"
          maxLength={120}
          enterKeyHint="search"
        />
      </div>

      {!lockedTier && (
        <Select label="Curriculum tier" name="tier" value={query.tier} onChange={onTierChange} emptyLabel="All tiers">
          {TIERS.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.title} ({t.range})
            </option>
          ))}
        </Select>
      )}

      {tier && tier.levels.length > 0 && (
        <Select label="Grade / Form" name="level" value={query.level} onChange={submit} emptyLabel="All levels">
          {tier.levels.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.label}
            </option>
          ))}
        </Select>
      )}

      {tier && (
        <Select label="Subject / area" name="subject" value={query.subject} onChange={submit} emptyLabel="All subjects">
          {tier.subjects.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.group ? `${s.name} (${s.group})` : s.name}
            </option>
          ))}
        </Select>
      )}

      <Select label="Resource type" name="type" value={query.type} onChange={submit} emptyLabel="All types">
        {RESOURCE_TYPES.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.label}
          </option>
        ))}
      </Select>

      {years.length > 0 && (
        <Select label="Year" name="year" value={query.year?.toString()} onChange={submit} emptyLabel="Any year">
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      )}

      <Select label="Sort by" name="sort" value={query.sort} onChange={submit}>
        {query.q && <option value="relevance">Best match</option>}
        <option value="popular">Most downloaded</option>
        <option value="newest">Newest</option>
        <option value="title">Title A–Z</option>
      </Select>

      {query.view === "list" && <input type="hidden" name="view" value="list" />}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1">
          <SlidersHorizontal aria-hidden className="size-4" /> Apply
        </button>
        <a href={action} className="btn-secondary">
          Reset
        </a>
      </div>
    </Form>
  );
}

function Select({
  label,
  name,
  value,
  onChange,
  emptyLabel,
  children,
}: {
  label: string;
  name: string;
  value: string | undefined;
  onChange: () => void;
  emptyLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="field-label">
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={value ?? ""} onChange={onChange} className="field-input">
        {emptyLabel && <option value="">{emptyLabel}</option>}
        {children}
      </select>
    </div>
  );
}
