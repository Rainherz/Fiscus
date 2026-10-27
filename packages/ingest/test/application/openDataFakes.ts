import type { OpenDataCsvRecord, OpenDataInvestment } from "../../src/domain/openData.js";
import type { OpenDataRepository, SourceSnapshot } from "../../src/ports/OpenDataRepository.js";
import type { OpenDataFileInfo, OpenDataSource } from "../../src/ports/OpenDataSource.js";

/** Keeps rows by CUI like the database upsert; rejects duplicate CUIs within one call like Postgres. */
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
    for (const row of rows) this.investments.set(row.cui, row);
    return rows.length;
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
