import type { ParalyzedWork } from "../domain/paralyzedWorks.js";

/** The last ingested edition of an editioned source (a source_snapshots row). */
export interface EditionSnapshot {
  source: string;
  editionCutoff: string | null;
  /** The file last ingested; the same URL means the same edition and file. */
  editionUrl: string | null;
  ingestedAt: string;
  checkedAt: string;
  rowsUpserted: number;
}

export interface ParalyzedWorksRepository {
  getEditionSnapshot(source: string): Promise<EditionSnapshot | null>;
  /**
   * Inserts or replaces obras by (edition_cutoff, infobras_code). Keys must be distinct within one
   * call. Returns the rows written.
   */
  upsertParalyzedWorks(rows: readonly ParalyzedWork[]): Promise<number>;
  recordEditionSnapshot(snapshot: EditionSnapshot): Promise<void>;
  /** A successful run that found the same edition: only the check time moves. */
  markChecked(source: string, checkedAt: string): Promise<void>;
}
