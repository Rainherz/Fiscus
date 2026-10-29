import type { OpenDataInvestment } from "../domain/openData.js";

/** The last successful ingest of an external file. */
export interface SourceSnapshot {
  source: string;
  lastModified: string | null;
  contentLength: number | null;
  /** Start of the last run that ingested the file. */
  ingestedAt: string;
  /** End of the last successful run, including runs that skipped the unchanged file. */
  checkedAt: string;
  rowsUpserted: number;
}

export interface OpenDataRepository {
  getSnapshot(source: string): Promise<SourceSnapshot | null>;
  /**
   * Inserts new investments and updates existing ones by CUI, without overwriting what the SSI
   * owns. CUIs must be distinct within one call. Returns the number of rows inserted or changed
   * (rows whose data is unchanged are not rewritten).
   */
  upsertOpenDataInvestments(rows: readonly OpenDataInvestment[]): Promise<number>;
  recordSnapshot(snapshot: SourceSnapshot): Promise<void>;
  /** Records a successful run that found the file unchanged: only the check time moves. */
  markChecked(source: string, checkedAt: string): Promise<void>;
}
