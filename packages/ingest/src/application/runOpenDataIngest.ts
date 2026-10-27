import { mapOpenDataRecord, type OpenDataInvestment } from "../domain/openData.js";
import type { OpenDataRepository, SourceSnapshot } from "../ports/OpenDataRepository.js";
import type { OpenDataFileInfo, OpenDataSource } from "../ports/OpenDataSource.js";

/** source_snapshots key of DETALLE_INVERSIONES.csv. */
export const OPEN_DATA_SOURCE = "mef_detalle_inversiones";

export interface RunOpenDataIngestInput {
  source: OpenDataSource;
  repository: OpenDataRepository;
  /** Ingest even when the file looks unchanged. */
  force?: boolean;
  /** Stop after reading this many rows (testing). A limited run never records the snapshot. */
  limit?: number;
  chunkSize?: number;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface OpenDataIngestSummary {
  /** True when the file was unchanged since the last ingest and nothing was downloaded. */
  skipped: boolean;
  file: OpenDataFileInfo;
  rowsRead: number;
  /** Rows dropped because they had no CUI. */
  rowsWithoutCui: number;
  /** Rows whose CUI already appeared earlier in the file (the last one wins). */
  duplicates: number;
  /** Distinct CUIs sent to the repository. */
  rowsUpserted: number;
  /** Rows the repository inserted or changed (unchanged rows are skipped). */
  rowsChanged: number;
  /** The following counts are over distinct CUIs (first occurrence). */
  byLevel: Record<string, number>;
  withCoordinates: number;
  withoutDepartment: number;
  withPhysicalProgress: number;
  snapshotRecorded: boolean;
  startedAt: string;
  finishedAt: string;
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  return Date.parse(a) === Date.parse(b);
}

function isUnchanged(file: OpenDataFileInfo, snapshot: SourceSnapshot | null): boolean {
  if (snapshot === null) return false;
  return sameInstant(file.lastModified, snapshot.lastModified) && file.contentLength === snapshot.contentLength;
}

/**
 * Streams the open-data file into the repository in chunks. Memory stays bounded by one chunk
 * plus the set of CUIs seen (to count duplicates). A repeated CUI replaces the earlier row in the
 * pending chunk; if the earlier row was already written, the later write overwrites it.
 */
export async function runOpenDataIngest({
  source,
  repository,
  force = false,
  limit,
  chunkSize = 1000,
  now = () => new Date(),
  log = console.log,
}: RunOpenDataIngestInput): Promise<OpenDataIngestSummary> {
  const startedAt = now().toISOString();
  const file = await source.describe();
  const summary: OpenDataIngestSummary = {
    skipped: false,
    file,
    rowsRead: 0,
    rowsWithoutCui: 0,
    duplicates: 0,
    rowsUpserted: 0,
    rowsChanged: 0,
    byLevel: {},
    withCoordinates: 0,
    withoutDepartment: 0,
    withPhysicalProgress: 0,
    snapshotRecorded: false,
    startedAt,
    finishedAt: startedAt,
  };

  if (!force && isUnchanged(file, await repository.getSnapshot(OPEN_DATA_SOURCE))) {
    log(`open data unchanged (Last-Modified ${file.lastModified}, ${file.contentLength} bytes); skipping`);
    return { ...summary, skipped: true, finishedAt: now().toISOString() };
  }

  const context = { sourceUpdatedAt: file.lastModified, runAt: startedAt };
  const seen = new Set<string>();
  let pending = new Map<string, OpenDataInvestment>();

  const flush = async () => {
    if (pending.size === 0) return;
    const rows = [...pending.values()];
    pending = new Map();
    summary.rowsChanged += await repository.upsertOpenDataInvestments(rows);
  };

  const track = (investment: OpenDataInvestment) => {
    if (seen.has(investment.cui)) {
      summary.duplicates++;
    } else {
      seen.add(investment.cui);
      const level = investment.governmentLevel ?? "unknown";
      summary.byLevel[level] = (summary.byLevel[level] ?? 0) + 1;
      if (investment.latitude !== null) summary.withCoordinates++;
      if (investment.departmentCode === null) summary.withoutDepartment++;
      if (investment.physicalProgress !== null) summary.withPhysicalProgress++;
    }
    pending.delete(investment.cui);
    pending.set(investment.cui, investment);
  };

  for await (const record of source.records()) {
    summary.rowsRead++;
    const investment = mapOpenDataRecord(record, context);
    if (investment === null) summary.rowsWithoutCui++;
    else track(investment);
    if (pending.size >= chunkSize) await flush();
    if (limit !== undefined && summary.rowsRead >= limit) break;
  }
  await flush();
  summary.rowsUpserted = seen.size;

  if (limit === undefined) {
    await repository.recordSnapshot({
      source: OPEN_DATA_SOURCE,
      lastModified: file.lastModified,
      contentLength: file.contentLength,
      ingestedAt: startedAt,
      rowsUpserted: summary.rowsUpserted,
    });
    summary.snapshotRecorded = true;
  }

  summary.finishedAt = now().toISOString();
  return summary;
}
