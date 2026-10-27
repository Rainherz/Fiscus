import type { OpenDataCsvRecord, OpenDataInvestment } from "../../src/domain/openData.js";
import type { OpenDataRepository, SourceSnapshot } from "../../src/ports/OpenDataRepository.js";
import type { OpenDataFileInfo, OpenDataSource } from "../../src/ports/OpenDataSource.js";

/** Keys ignored when deciding whether a row changed (mirrors public.touch_ingested_at). */
const BOOKKEEPING = new Set(["openDataUpdatedAt", "sourceUpdatedAt"]);

function sameData(a: OpenDataInvestment, b: OpenDataInvestment): boolean {
  const strip = (row: OpenDataInvestment) =>
    JSON.stringify(Object.entries(row).filter(([key]) => !BOOKKEEPING.has(key)));
  return strip(a) === strip(b);
}

/**
 * Keeps rows by CUI like the database upsert; rejects duplicate CUIs within one call like Postgres.
 * Returns the rows actually written: unchanged rows are skipped like the database trigger does.
 */
export class InMemoryOpenDataRepository implements OpenDataRepository {
  readonly investments = new Map<string, OpenDataInvestment>();
  readonly snapshots = new Map<string, SourceSnapshot>();
  readonly upsertBatchSizes: number[] = [];
  failOnCall: number | null = null;

  async getSnapshot(source: string): Promise<SourceSnapshot | null> {
    return this.snapshots.get(source) ?? null;
  }

  async upsertOpenDataInvestments(rows: readonly OpenDataInvestment[]): Promise<number> {
    this.upsertBatchSizes.push(rows.length);
    if (this.failOnCall === this.upsertBatchSizes.length) throw new Error("db unavailable");
    if (new Set(rows.map((r) => r.cui)).size !== rows.length) {
      throw new Error("ON CONFLICT DO UPDATE command cannot affect row a second time");
    }
    let written = 0;
    for (const row of rows) {
      const current = this.investments.get(row.cui);
      if (current && sameData(current, row)) continue;
      this.investments.set(row.cui, row);
      written++;
    }
    return written;
  }

  async recordSnapshot(snapshot: SourceSnapshot): Promise<void> {
    this.snapshots.set(snapshot.source, snapshot);
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
