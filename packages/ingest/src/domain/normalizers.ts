/**
 * Pure normalizers for loosely-typed spreadsheet values.
 * Every function is total: unexpected input yields null instead of throwing.
 */

export function parseText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = parseText(value);
  if (text === null) return null;
  const cleaned = text.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseInteger(value: unknown): number | null {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!valid) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** dd/mm/yyyy -> yyyy-mm-dd */
export function parseDayMonthYear(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return isoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  const text = parseText(value);
  if (text === null) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  return isoDate(Number(match[3]), Number(match[2]), Number(match[1]));
}

/** yyyy-mm -> yyyy-mm-01 (first day of the month) */
export function parseYearMonth(value: unknown): string | null {
  const text = parseText(value);
  if (text === null) return null;
  const match = /^(\d{4})-(\d{1,2})$/.exec(text);
  if (!match) return null;
  return isoDate(Number(match[1]), Number(match[2]), 1);
}
