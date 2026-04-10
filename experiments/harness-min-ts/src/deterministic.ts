/**
 * Deterministic transforms that must not depend on an LLM (TC-3.1).
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Normalizes a date string to ISO `YYYY-MM-DD` if input matches that shape; otherwise returns trimmed input.
 *
 * @param raw - User-supplied date fragment.
 */
export const normalizeIsoDate = (raw: string): string => {
  const trimmed = raw.trim();
  const match = ISO_DATE.exec(trimmed);
  if (!match) {
    return trimmed;
  }
  const [, y, m, d] = match;
  return `${y}-${m}-${d}`;
};
