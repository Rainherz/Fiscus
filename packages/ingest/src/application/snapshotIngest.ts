import type { OpenDataContext, OpenDataCsvRecord } from "../domain/openData.js";
import type { OpenDataRepository, SourceSnapshot } from "../ports/OpenDataRepository.js";
import type { OpenDataFileInfo, OpenDataSource } from "../ports/OpenDataSource.js";

/** The fields every open-data row has, for keying and the summary counts. */
export interface SnapshotRow {
  cui: string;
  governmentLevel: string | null;
  latitude: number | null;
  departmentCode: number | null;
}

/** One MEF open-data file: how its rows are mapped and written, and its source_snapshots key. */
export interface SnapshotDataset<T extends SnapshotRow, K extends string> {
  /** source_snapshots.source of the file. */
  source: string;
  /** For log lines ("open data", "closed data"). */
  label: string;
  /** Null when the record cannot be keyed (no CUI). */
  map(record: OpenDataCsvRecord, context: OpenDataContext): T | null;
  upsert(repository: OpenDataRepository, rows: readonly T[]): Promise<number>;
  /** Extra summary counts over distinct CUIs (first occurrence), by name. */
  counters: Record<K, (row: T) => boolean>;
}

export interface SnapshotIngestInput {
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

export interface SnapshotIngestBaseSummary {
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
  snapshotRecorded: boolean;
  /** When the snapshot's checked_at was set (successful full or skipped runs); null otherwise. */
  checkedAt: string | null;
  startedAt: string;
  finishedAt: string;
}

export type SnapshotIngestSummary<K extends string> = SnapshotIngestBaseSummary & Record<K, number>;

function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  return Date.parse(a) === Date.parse(b);
}

function isUnchanged(file: OpenDataFileInfo, snapshot: SourceSnapshot | null): boolean {
  if (snapshot === null) return false;
  return sameInstant(file.lastModified, snapshot.lastModified) && file.contentLength === snapshot.contentLength;
}

/**
 * Streams an open-data file into the repository in chunks. Memory stays bounded by one chunk plus
 * the set of CUIs seen (to count duplicates). A repeated CUI replaces the earlier row in the
 * pending chunk; if the earlier row was already written, the later write overwrites it. When
 * Last-Modified and Content-Length match the dataset's snapshot, nothing is downloaded and only
 * the snapshot's checked_at moves.
 */
export async function runSnapshotIngest<T extends SnapshotRow, K extends string>(
  dataset: SnapshotDataset<T, K>,
  {
    source,
    repository,
    force = false,
    limit,
    chunkSize = 1000,
    now = () => new Date(),
    log = console.log,
  }: SnapshotIngestInput,
): Promise<SnapshotIngestSummary<K>> {
  const startedAt = now().toISOString();
  const file = await source.describe();
  const counterNames = Object.keys(dataset.counters) as K[];
  const counts = Object.fromEntries(counterNames.map((name) => [name, 0])) as Record<K, number>;
  const summary: SnapshotIngestBaseSummary = {
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
    snapshotRecorded: false,
    checkedAt: null,
    startedAt,
    finishedAt: startedAt,
  };
  const result = (): SnapshotIngestSummary<K> => ({ ...summary, ...counts });

  if (!force && isUnchanged(file, await repository.getSnapshot(dataset.source))) {
    log(`${dataset.label} unchanged (Last-Modified ${file.lastModified}, ${file.contentLength} bytes); skipping`);
    const checkedAt = now().toISOString();
    await repository.markChecked(dataset.source, checkedAt);
    Object.assign(summary, { skipped: true, checkedAt, finishedAt: checkedAt });
    return result();
  }

  const context: OpenDataContext = { sourceUpdatedAt: file.lastModified, runAt: startedAt };
  const seen = new Set<string>();
  let pending = new Map<string, T>();

  const flush = async () => {
    if (pending.size === 0) return;
    const rows = [...pending.values()];
    pending = new Map();
    summary.rowsChanged += await dataset.upsert(repository, rows);
  };

  const track = (row: T) => {
    if (seen.has(row.cui)) {
      summary.duplicates++;
    } else {
      seen.add(row.cui);
      const level = row.governmentLevel ?? "unknown";
      summary.byLevel[level] = (summary.byLevel[level] ?? 0) + 1;
      if (row.latitude !== null) summary.withCoordinates++;
      if (row.departmentCode === null) summary.withoutDepartment++;
      for (const name of counterNames) if (dataset.counters[name](row)) counts[name]++;
    }
    pending.delete(row.cui);
    pending.set(row.cui, row);
  };

  for await (const record of source.records()) {
    summary.rowsRead++;
    const row = dataset.map(record, context);
    if (row === null) summary.rowsWithoutCui++;
    else track(row);
    if (pending.size >= chunkSize) await flush();
    if (limit !== undefined && summary.rowsRead >= limit) break;
  }
  await flush();
  summary.rowsUpserted = seen.size;

  summary.finishedAt = now().toISOString();
  if (limit === undefined) {
    await repository.recordSnapshot({
      source: dataset.source,
      lastModified: file.lastModified,
      contentLength: file.contentLength,
      ingestedAt: startedAt,
      checkedAt: summary.finishedAt,
      rowsUpserted: summary.rowsUpserted,
    });
    summary.snapshotRecorded = true;
    summary.checkedAt = summary.finishedAt;
  }

  return result();
}
