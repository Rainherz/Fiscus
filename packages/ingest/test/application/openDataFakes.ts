import type { ClosedInvestment } from "../../src/domain/closedData.js";
import type { OpenDataCsvRecord, OpenDataInvestment } from "../../src/domain/openData.js";
import type { OpenDataRepository, SourceSnapshot } from "../../src/ports/OpenDataRepository.js";
import type { OpenDataFileInfo, OpenDataSource } from "../../src/ports/OpenDataSource.js";

/** Keys ignored when deciding whether a row changed (mirrors public.touch_ingested_at). */
const BOOKKEEPING = new Set(["openDataUpdatedAt", "sourceUpdatedAt"]);

function sameData<T extends object>(a: T, b: T): boolean {
  const strip = (row: T) =>
    JSON.stringify(Object.entries(row).filter(([key]) => !BOOKKEEPING.has(key)));
  return strip(a) === strip(b);
}

/**
 * Keeps rows by CUI like the database upsert; rejects duplicate CUIs within one call like Postgres.
 * Returns the rows actually written: unchanged rows are skipped like the database trigger does.
 */
export class InMemoryOpenDataRepository implements OpenDataRepository {
  readonly investments = new Map<string, OpenDataInvestment>();
  /** Rows written by upsertClosedInvestments (kept apart: the ownership rule lives in SQL). */
  readonly closedInvestments = new Map<string, ClosedInvestment>();
  readonly snapshots = new Map<string, SourceSnapshot>();
  readonly upsertBatchSizes: number[] = [];
  readonly checks: Array<{ source: string; checkedAt: string }> = [];
  failOnCall: number | null = null;

  async getSnapshot(source: string): Promise<SourceSnapshot | null> {
    return this.snapshots.get(source) ?? null;
  }

  async upsertOpenDataInvestments(rows: readonly OpenDataInvestment[]): Promise<number> {
    return this.upsert(this.investments, rows);
  }

  async upsertClosedInvestments(rows: readonly ClosedInvestment[]): Promise<number> {
    return this.upsert(this.closedInvestments, rows);
  }

  private upsert<T extends { cui: string }>(store: Map<string, T>, rows: readonly T[]): number {
    this.upsertBatchSizes.push(rows.length);
    if (this.failOnCall === this.upsertBatchSizes.length) throw new Error("db unavailable");
    if (new Set(rows.map((r) => r.cui)).size !== rows.length) {
      throw new Error("ON CONFLICT DO UPDATE command cannot affect row a second time");
    }
    let written = 0;
    for (const row of rows) {
      const current = store.get(row.cui);
      if (current && sameData(current, row)) continue;
      store.set(row.cui, row);
      written++;
    }
    return written;
  }

  async recordSnapshot(snapshot: SourceSnapshot): Promise<void> {
    this.snapshots.set(snapshot.source, snapshot);
  }

  async markChecked(source: string, checkedAt: string): Promise<void> {
    this.checks.push({ source, checkedAt });
    const snapshot = this.snapshots.get(source);
    if (snapshot) this.snapshots.set(source, { ...snapshot, checkedAt });
  }
}

export class FakeOpenDataSource implements OpenDataSource {
  describeCalls = 0;
  recordsCalls = 0;
  recordsYielded = 0;

  constructor(
    private readonly info: OpenDataFileInfo,
    private readonly rows: readonly OpenDataCsvRecord[],
  ) {}

  async describe(): Promise<OpenDataFileInfo> {
    this.describeCalls++;
    return this.info;
  }

  async *records(): AsyncIterable<OpenDataCsvRecord> {
    this.recordsCalls++;
    for (const row of this.rows) {
      this.recordsYielded++;
      yield row;
    }
  }
}
