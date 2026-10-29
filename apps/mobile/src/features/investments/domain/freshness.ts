/**
 * How fresh the data is, from `public.data_freshness`
 * (supabase/migrations/20261104000000_data_freshness.sql).
 */

/** data_freshness.source of the SSI report. */
export const SSI_FRESHNESS_SOURCE = 'ssi';
/** data_freshness.source of the open-data file (DETALLE_INVERSIONES.csv). */
export const OPEN_DATA_FRESHNESS_SOURCE = 'mef_detalle_inversiones';

/**
 * The SSI ingest runs daily around 04:00 Lima from a machine that may be off for a while: 48 h
 * allows one missed or late run before the app warns.
 */
export const STALE_AFTER_HOURS = 48;

export interface DataFreshness {
  /** End of the latest SSI run that ingested at least one department; null if none. */
  ssiLastSuccessAt: string | null;
  /** Last successful open-data run, also when the file was unchanged; null if none. */
  openDataCheckedAt: string | null;
}

/** Row shape of `public.data_freshness`. */
export interface DataFreshnessRow {
  source: string;
  last_success_at: string | null;
  last_checked_at: string | null;
}

export function mapDataFreshnessRows(rows: readonly DataFreshnessRow[]): DataFreshness {
  const find = (source: string) => rows.find((row) => row.source === source);
  return {
    ssiLastSuccessAt: find(SSI_FRESHNESS_SOURCE)?.last_success_at ?? null,
    openDataCheckedAt: find(OPEN_DATA_FRESHNESS_SOURCE)?.last_checked_at ?? null,
  };
}

/**
 * True when the last successful SSI update is older than the threshold. Only the SSI is judged:
 * MEF refreshes the open-data file rarely, so an old file is normal. Without a usable date
 * nothing is claimed (false).
 */
export function isSsiStale(freshness: DataFreshness, now: Date, thresholdHours = STALE_AFTER_HOURS): boolean {
  if (!freshness.ssiLastSuccessAt) return false;
  const time = Date.parse(freshness.ssiLastSuccessAt);
  if (Number.isNaN(time)) return false;
  return now.getTime() - time > thresholdHours * 3_600_000;
}
