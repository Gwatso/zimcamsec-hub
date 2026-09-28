/**
 * Converts free-text user input into a safe Postgres prefix tsquery, e.g.
 * "O level maths 2023" -> "o:* & level:* & maths:* & 2023:*".
 *
 * Only letter/number runs survive, so tsquery operators (&, |, !, :, parens)
 * typed by users can never produce a syntax error. The result is still passed
 * as a bound parameter, never interpolated.
 */
export const MAX_SEARCH_TERMS = 8;
const MAX_TERM_LENGTH = 32;

export function toPrefixTsQuery(input: string | null | undefined): string | null {
  if (!input) return null;
  const tokens =
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .match(/[\p{L}\p{N}]+/gu) ?? [];

  const unique = [...new Set(tokens)].slice(0, MAX_SEARCH_TERMS).map((t) => t.slice(0, MAX_TERM_LENGTH));
  if (unique.length === 0) return null;
  return unique.map((t) => `${t}:*`).join(" & ");
}
