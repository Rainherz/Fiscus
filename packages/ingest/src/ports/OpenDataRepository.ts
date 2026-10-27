import type { OpenDataInvestment } from "../domain/openData.js";

/** The last successful ingest of an external file. */
export interface SourceSnapshot {
  source: string;
  lastModified: string | null;
  contentLength: number | null;
  ingestedAt: string;
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
}
