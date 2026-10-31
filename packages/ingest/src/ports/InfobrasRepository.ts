import type { InfobrasWork } from "../domain/infobrasWorks.js";

/** The last ingested INFOBRAS file (a source_snapshots row). */
export interface InfobrasSnapshot {
  source: string;
  /** Download URL of the file; it carries the file name, which changes with every daily file. */
  fileUrl: string | null;
  contentLength: number | null;
  /** yyyy-mm-dd: the latest progress registration date in the file. */
  dataAsOf: string | null;
  ingestedAt: string;
  checkedAt: string;
  rowsUpserted: number;
}

export interface InfobrasRepository {
  getSnapshot(source: string): Promise<InfobrasSnapshot | null>;
  /**
   * Inserts or updates obras by infobras_code; unchanged rows are not rewritten. Codes must be
   * distinct within one call. Returns the rows inserted or changed.
   */
  upsertWorks(rows: readonly InfobrasWork[]): Promise<number>;
  /**
   * Marks as removed every obra whose code is not in the list (the file no longer has it); rows are
   * kept. Returns the rows newly marked.
   */
  markRemoved(presentCodes: readonly number[]): Promise<number>;
  /**
   * Recomputes the contractor totals (a materialized view whose scope columns come from
   * investments). Called after every run, also when the file was skipped.
   */
  refreshContractorTotals(): Promise<void>;
  recordSnapshot(snapshot: InfobrasSnapshot): Promise<void>;
  /** A successful run that found the same file: only the check time moves. */
  markChecked(source: string, checkedAt: string): Promise<void>;
}
