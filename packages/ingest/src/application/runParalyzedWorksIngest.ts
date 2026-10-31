import { mapParalyzedRecord, type ParalyzedWork } from "../domain/paralyzedWorks.js";
import type { ParalyzedWorksRepository } from "../ports/ParalyzedWorksRepository.js";
import type { ParalyzedEdition, ParalyzedWorksSource } from "../ports/ParalyzedWorksSource.js";

/** source_snapshots key (and data_freshness source) of the Contraloría report. */
export const PARALYZED_SOURCE = "contraloria_obras_paralizadas";

export interface ParalyzedWorksIngestInput {
  source: ParalyzedWorksSource;
  repository: ParalyzedWorksRepository;
  /** Ingest even when the edition's file was already ingested. */
  force?: boolean;
  chunkSize?: number;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface ParalyzedWorksIngestSummary {
  edition: ParalyzedEdition;
  /** True when the edition's file was already ingested and nothing was downloaded. */
  skipped: boolean;
  rowsRead: number;
  /** Rows without an INFOBRAS code (cannot be keyed). */
  rowsWithoutCode: number;
  /** Rows whose INFOBRAS code appeared earlier in the file (the last one wins). */
  duplicates: number;
  /** Obras sent to the repository. */
  rowsUpserted: number;
  /** The following counts are over the obras sent. */
  distinctCuis: number;
  withoutCui: number;
  byLevel: Record<string, number>;
  /** Obras in the MEF inventory of paralyzed works. */
  mefInventory: number;
  /** Obras whose department name did not match a department. */
  withoutDepartment: number;
  snapshotRecorded: boolean;
  checkedAt: string | null;
  startedAt: string;
  finishedAt: string;
}

/**
 * Finds the latest edition, and unless its spreadsheet (by URL) was already ingested, downloads it
 * and upserts every obra by (edition_cutoff, infobras_code). Earlier editions stay in the table.
 */
export async function runParalyzedWorksIngest({
  source,
  repository,
  force = false,
  chunkSize = 500,
  now = () => new Date(),
  log = console.log,
}: ParalyzedWorksIngestInput): Promise<ParalyzedWorksIngestSummary> {
  const startedAt = now().toISOString();
  const edition = await source.latestEdition();
  const summary: ParalyzedWorksIngestSummary = {
    edition,
    skipped: false,
    rowsRead: 0,
    rowsWithoutCode: 0,
    duplicates: 0,
    rowsUpserted: 0,
    distinctCuis: 0,
    withoutCui: 0,
    byLevel: {},
    mefInventory: 0,
    withoutDepartment: 0,
    snapshotRecorded: false,
    checkedAt: null,
    startedAt,
    finishedAt: startedAt,
  };

  const snapshot = await repository.getEditionSnapshot(PARALYZED_SOURCE);
  if (!force && snapshot !== null && snapshot.editionUrl === edition.xlsxUrl) {
    log(`edition ${edition.cutoff} already ingested (${edition.xlsxUrl}); skipping`);
    const checkedAt = now().toISOString();
    await repository.markChecked(PARALYZED_SOURCE, checkedAt);
    return { ...summary, skipped: true, checkedAt, finishedAt: checkedAt };
  }

  const context = { cutoff: edition.cutoff, publishedAt: edition.publishedAt };
  const works = new Map<number, ParalyzedWork>();
  for (const record of await source.records(edition)) {
    summary.rowsRead++;
    const work = mapParalyzedRecord(record, context);
    if (work === null) {
      summary.rowsWithoutCode++;
      continue;
    }
    if (works.has(work.infobrasCode)) {
      summary.duplicates++;
      works.delete(work.infobrasCode);
    }
    works.set(work.infobrasCode, work);
  }
  if (works.size === 0) {
    throw new Error(`edition ${edition.cutoff}: no obra with an INFOBRAS code in ${summary.rowsRead} rows`);
  }

  const rows = [...works.values()];
  const cuis = new Set<string>();
  for (const work of rows) {
    if (work.cui === null) summary.withoutCui++;
    else cuis.add(work.cui);
    const level = work.governmentLevel ?? "unknown";
    summary.byLevel[level] = (summary.byLevel[level] ?? 0) + 1;
    if (work.mefInventory) summary.mefInventory++;
    if (work.departmentCode === null) summary.withoutDepartment++;
  }
  summary.distinctCuis = cuis.size;

  for (let start = 0; start < rows.length; start += chunkSize) {
    summary.rowsUpserted += await repository.upsertParalyzedWorks(rows.slice(start, start + chunkSize));
  }

  const finishedAt = now().toISOString();
  await repository.recordEditionSnapshot({
    source: PARALYZED_SOURCE,
    editionCutoff: edition.cutoff,
    editionUrl: edition.xlsxUrl,
    ingestedAt: startedAt,
    checkedAt: finishedAt,
    rowsUpserted: summary.rowsUpserted,
  });
  return { ...summary, snapshotRecorded: true, checkedAt: finishedAt, finishedAt };
}
