/**
 * Display formatters. Pure, locale-independent (no Intl) so output is identical on Hermes,
 * JSC and browsers. Conventions follow the Peruvian press: comma thousands separator,
 * dot decimal separator, amounts in millions ("S/ 5,148 M").
 */

const DASH = '—';
const MILLION = 1_000_000;
/** Peru has no DST: Lima is always UTC-5. */
const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatInteger(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  const sign = value < 0 ? '-' : '';
  return sign + groupThousands(Math.round(Math.abs(value)).toString());
}

function solesMagnitude(abs: number): string {
  if (abs >= 10 * MILLION) return `S/ ${groupThousands(Math.round(abs / MILLION).toString())} M`;
  if (abs >= MILLION) return `S/ ${(abs / MILLION).toFixed(1)} M`;
  return `S/ ${groupThousands(Math.round(abs).toString())}`;
}

export function formatSoles(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  return (value < 0 ? '-' : '') + solesMagnitude(Math.abs(value));
}

export function formatSignedSoles(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  if (value === 0) return solesMagnitude(0);
  return (value > 0 ? '+' : '-') + solesMagnitude(Math.abs(value));
}

export function formatSignedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  const rounded = Math.round(value);
  if (rounded === 0) return '0%';
  return (rounded > 0 ? '+' : '-') + groupThousands(Math.abs(rounded).toString()) + '%';
}

/** `ratio` is accrued / updated cost (1 = fully accrued). Values above 1 are kept as-is. */
export function formatProgress(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return DASH;
  return `${formatInteger(ratio * 100)} %`;
}

interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Date-only strings are read as calendar dates; timestamps are converted to Lima time. */
function toCalendarDate(value: string | null): CalendarDate | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return { year: Number(dateOnly[1]), month: Number(dateOnly[2]), day: Number(dateOnly[3]) };
  }
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  const lima = new Date(time + LIMA_OFFSET_MS);
  return { year: lima.getUTCFullYear(), month: lima.getUTCMonth() + 1, day: lima.getUTCDate() };
}

const pad2 = (n: number) => n.toString().padStart(2, '0');

export function formatDate(value: string | null): string {
  const date = toCalendarDate(value);
  if (!date) return DASH;
  return `${pad2(date.day)}/${pad2(date.month)}/${date.year}`;
}

export function formatMonth(value: string | null): string {
  const date = toCalendarDate(value);
  if (!date) return DASH;
  return `${MONTHS[date.month - 1]} ${date.year}`;
}

/** Full years elapsed between `value` and `now`. */
export function yearsSince(value: string | null, now: Date = new Date()): number | null {
  const from = toCalendarDate(value);
  const to = toCalendarDate(now.toISOString());
  if (!from || !to) return null;
  let years = to.year - from.year;
  if (to.month < from.month || (to.month === from.month && to.day < from.day)) years -= 1;
  return years;
}

export function formatYears(years: number | null): string {
  if (years === null) return DASH;
  if (years < 1) return 'Menos de 1 año';
  return years === 1 ? '1 año' : `${years} años`;
}

export function formatYear(value: string | null): string {
  return toCalendarDate(value)?.year.toString() ?? DASH;
}
