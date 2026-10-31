import type { InfobrasDataSetLink } from "../domain/infobrasDataSets.js";
import { dataAsOf, mapInfobrasRecord, type InfobrasWork } from "../domain/infobrasWorks.js";
import type { InfobrasRepository } from "../ports/InfobrasRepository.js";
import type { InfobrasSource } from "../ports/InfobrasSource.js";

/** source_snapshots key (and data_freshness source) of the INFOBRAS obras dataset. */
export const INFOBRAS_SOURCE = "infobras_obras";

export interface InfobrasIngestInput {
  source: InfobrasSource;
  repository: InfobrasRepository;
  /** Ingest even when the file looks the same as the last one. */
  force?: boolean;
  chunkSize?: number;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface InfobrasIngestSummary {
  dataSet: InfobrasDataSetLink;
  skipped: boolean;
  /** same-file: the page links the file already ingested; same-size: a new name, the same Content-Length. */
  skipReason: "same-file" | "same-size" | null;
  bytes: number;
  rowsRead: number;
  /** Rows without a valid INFOBRAS code (cannot be keyed). */
  rowsWithoutCode: number;
  /** Rows whose code appeared earlier in the file (the first one is kept). */
  duplicates: number;
  /** Distinct obras sent to the repository; the counts below are over them. */
  obras: number;
  /** Obras inserted or changed (unchanged rows are not rewritten). */
  rowsWritten: number;
  /** Obras in the table that the file no longer has, newly marked as removed. */
  removed: number;
  withCui: number;
  byStatus: Record<string, number>;
  contractorKinds: Record<string, number>;
  supervisorKinds: Record<string, number>;
  /** Latest progress registration date: what the data describes, not when the file was made. */
  dataAsOf: string | null;
  snapshotRecorded: boolean;
  checkedAt: string | null;
  startedAt: string;
  finishedAt: string;
}

const increment = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

/**
 * Finds the current INFOBRAS obras file and, unless it is the file already ingested (same name, or
 * same size), downloads it to a temporary file, streams its rows and upserts them in chunks. Obras
 * the file no longer has are marked as removed, never deleted.
 */
export async function runInfobrasIngest({
  source,
  repository,
  force = false,
  chunkSize = 1000,
  now = () => new Date(),
  log = console.log,
}: InfobrasIngestInput): Promise<InfobrasIngestSummary> {
  const startedAt = now().toISOString();
  const dataSet = await source.latestDataSet();
  const summary: InfobrasIngestSummary = {
    dataSet,
    skipped: false,
    skipReason: null,
    bytes: 0,
    rowsRead: 0,
    rowsWithoutCode: 0,
    duplicates: 0,
    obras: 0,
    rowsWritten: 0,
    removed: 0,
    withCui: 0,
    byStatus: {},
    contractorKinds: {},
    supervisorKinds: {},
    dataAsOf: null,
    snapshotRecorded: false,
    checkedAt: null,
    startedAt,
    finishedAt: startedAt,
  };

  const skip = async (reason: "same-file" | "same-size"): Promise<InfobrasIngestSummary> => {
    log(`${dataSet.filename}: ${reason === "same-file" ? "already ingested" : "same size as the last file"}; skipping`);
    // The contractor totals take their scope from investments, which change daily.
    await repository.refreshContractorTotals();
    const checkedAt = now().toISOString();
    await repository.markChecked(INFOBRAS_SOURCE, checkedAt);
    return { ...summary, skipped: true, skipReason: reason, checkedAt, finishedAt: checkedAt };
  };

  const snapshot = await repository.getSnapshot(INFOBRAS_SOURCE);
  if (!force && snapshot !== null && snapshot.fileUrl === dataSet.url) return skip("same-file");
  const file = await source.download(dataSet, { skipIfLength: force ? null : (snapshot?.contentLength ?? null) });
  if (file === null) return skip("same-size");
  summary.bytes = file.bytes;

  try {
    const today = startedAt.slice(0, 10);
    const seen = new Set<number>();
    let chunk: InfobrasWork[] = [];
    const flush = async () => {
      if (chunk.length === 0) return;
      summary.rowsWritten += await repository.upsertWorks(chunk);
      summary.dataAsOf = dataAsOf([{ progressRegisteredAt: summary.dataAsOf }, ...chunk], today);
      chunk = [];
    };

    for await (const record of source.records(file.path)) {
      summary.rowsRead++;
      const work = mapInfobrasRecord(record);
      if (work === null) {
        summary.rowsWithoutCode++;
        continue;
      }
      if (seen.has(work.infobrasCode)) {
        summary.duplicates++;
        continue;
      }
      seen.add(work.infobrasCode);
      if (work.cui !== null) summary.withCui++;
      increment(summary.byStatus, work.executionStatus ?? "unknown");
      increment(summary.contractorKinds, work.contractorKind ?? "none");
      increment(summary.supervisorKinds, work.supervisorKind ?? "none");
      chunk.push(work);
      if (chunk.length >= chunkSize) await flush();
    }
    await flush();
    summary.obras = seen.size;
    if (seen.size === 0) throw new Error(`${dataSet.filename}: no obra with an INFOBRAS code in ${summary.rowsRead} rows`);

    summary.removed = await repository.markRemoved([...seen]);
  } finally {
    await file.cleanup();
  }

  await repository.refreshContractorTotals();
  const finishedAt = now().toISOString();
  await repository.recordSnapshot({
    source: INFOBRAS_SOURCE,
    fileUrl: dataSet.url,
    contentLength: file.bytes,
    dataAsOf: summary.dataAsOf,
    ingestedAt: startedAt,
    checkedAt: finishedAt,
    rowsUpserted: summary.rowsWritten,
  });
  return { ...summary, snapshotRecorded: true, checkedAt: finishedAt, finishedAt };
}
