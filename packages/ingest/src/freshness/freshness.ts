/**
 * Data freshness check behind .github/workflows/data-freshness.yml: reads public.data_freshness
 * (supabase/migrations/20261104000000_data_freshness.sql) and decides whether the "Datos
 * desactualizados" issue must be opened, updated or closed. Pure: no I/O, the clock is injected.
 */

/** data_freshness.source of the SSI report (ingest_runs). */
export const SSI_FRESHNESS_SOURCE = "ssi";
/** data_freshness.source of DETALLE_INVERSIONES.csv (source_snapshots). */
export const OPEN_DATA_FRESHNESS_SOURCE = "mef_detalle_inversiones";
/** data_freshness.source of CIERRE_INVERSIONES.csv (source_snapshots). */
export const CLOSED_DATA_FRESHNESS_SOURCE = "mef_cierre_inversiones";

export const STALE_ISSUE_TITLE = "Datos desactualizados";
export const STALE_ISSUE_LABEL = "data-stale";
/** Every ingest runs daily, so 36 h tolerates one late run but not a missed day. */
export const DEFAULT_MAX_AGE_HOURS = 36;

export interface FreshnessRow {
  source: string;
  lastSuccessAt: string | null;
  lastCheckedAt: string | null;
}

export interface FreshnessCheck {
  key: "ssi" | "open-data" | "closed-data";
  label: string;
  /** The timestamp judged; null when the source has none. */
  at: string | null;
  /** Hours between `at` and now, rounded to 0.1; null without a timestamp. */
  ageHours: number | null;
  stale: boolean;
}

export interface FreshnessEvaluation {
  stale: boolean;
  maxAgeHours: number;
  checks: FreshnessCheck[];
}

function stringOrNull(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`data_freshness: ${field} must be a string or null`);
  return value;
}

/** Rows of the PostgREST response for data_freshness (snake_case JSON). */
export function parseFreshnessRows(json: unknown): FreshnessRow[] {
  if (!Array.isArray(json)) throw new Error("data_freshness: expected a JSON array");
  return json.map((item: Record<string, unknown>) => {
    if (typeof item?.source !== "string") throw new Error("data_freshness: source must be a string");
    return {
      source: item.source,
      lastSuccessAt: stringOrNull(item.last_success_at, "last_success_at"),
      lastCheckedAt: stringOrNull(item.last_checked_at, "last_checked_at"),
    };
  });
}

function check(key: FreshnessCheck["key"], label: string, at: string | null, now: Date, maxAgeHours: number) {
  const time = at === null ? Number.NaN : Date.parse(at);
  if (Number.isNaN(time)) return { key, label, at, ageHours: null, stale: true };
  const ageHours = Math.round((now.getTime() - time) / 360_000) / 10;
  return { key, label, at, ageHours, stale: ageHours > maxAgeHours };
}

/**
 * The SSI is judged by its last successful ingest (a run with at least one department ingested).
 * Both open-data files (active and closed investments) by their last check: MEF refreshes them
 * rarely, so an old ingest is expected; what must not stop is the daily run that compares each
 * file. A missing source is stale.
 */
export function evaluateFreshness(
  rows: readonly FreshnessRow[],
  now: Date,
  { maxAgeHours = DEFAULT_MAX_AGE_HOURS }: { maxAgeHours?: number } = {},
): FreshnessEvaluation {
  const find = (source: string) => rows.find((row) => row.source === source);
  const checks: FreshnessCheck[] = [
    check("ssi", "SSI: última ingesta exitosa", find(SSI_FRESHNESS_SOURCE)?.lastSuccessAt ?? null, now, maxAgeHours),
    check(
      "open-data",
      "Datos abiertos: última revisión",
      find(OPEN_DATA_FRESHNESS_SOURCE)?.lastCheckedAt ?? null,
      now,
      maxAgeHours,
    ),
    check(
      "closed-data",
      "Datos abiertos de cierres: última revisión",
      find(CLOSED_DATA_FRESHNESS_SOURCE)?.lastCheckedAt ?? null,
      now,
      maxAgeHours,
    ),
  ];
  return { stale: checks.some((c) => c.stale), maxAgeHours, checks };
}

const LIMA = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** dd/mm/yyyy hh:mm in Lima time. */
function limaTime(iso: string): string {
  const parts = Object.fromEntries(LIMA.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

export function renderStaleIssueBody(evaluation: FreshnessEvaluation, { runUrl }: { runUrl: string }): string {
  const lines = evaluation.checks.map(
    (c) =>
      `| ${c.label} | ${c.at === null ? "sin registro" : limaTime(c.at)} | ${c.ageHours === null ? "—" : `${c.ageHours} h`} | ${c.stale ? "Desactualizado" : "Al día"} |`,
  );
  return [
    `Una fuente se considera desactualizada cuando su última actualización tiene más de ${evaluation.maxAgeHours} h.`,
    "",
    "| Fuente | Fecha (hora de Lima) | Antigüedad | Estado |",
    "|---|---|---|---|",
    ...lines,
    "",
    `Revisión: ${runUrl}`,
  ].join("\n");
}

export type StaleIssueAction =
  | { kind: "none" }
  | { kind: "open"; title: string; body: string }
  | { kind: "update"; issue: number; body: string }
  | { kind: "close"; issue: number; comment: string };

/** What to do with the "Datos desactualizados" issue, given the open one (its number) or null. */
export function planStaleIssue(
  evaluation: FreshnessEvaluation,
  openIssue: number | null,
  context: { runUrl: string },
): StaleIssueAction {
  const body = renderStaleIssueBody(evaluation, context);
  if (evaluation.stale) {
    return openIssue === null
      ? { kind: "open", title: STALE_ISSUE_TITLE, body }
      : { kind: "update", issue: openIssue, body };
  }
  return openIssue === null ? { kind: "none" } : { kind: "close", issue: openIssue, comment: `Datos al día de nuevo.\n\n${body}` };
}
