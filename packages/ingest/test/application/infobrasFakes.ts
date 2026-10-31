import type { InfobrasDataSetLink } from "../../src/domain/infobrasDataSets.js";
import type { InfobrasRecord, InfobrasWork } from "../../src/domain/infobrasWorks.js";
import type { InfobrasRepository, InfobrasSnapshot } from "../../src/ports/InfobrasRepository.js";
import type { DownloadedDataSet, InfobrasSource } from "../../src/ports/InfobrasSource.js";

export const OCT_30: InfobrasDataSetLink = {
  url: "https://infobras.contraloria.gob.pe/InfobrasWeb/Archivo/DownloadFile?filename=DataSet-Obras-Publicas%2030-10-2026",
  filename: "DataSet-Obras-Publicas 30-10-2026",
  fileDate: "2026-10-30",
};

export const OCT_31: InfobrasDataSetLink = {
  url: "https://infobras.contraloria.gob.pe/InfobrasWeb/Archivo/DownloadFile?filename=DataSet-Obras-Publicas%2031-10-2026",
  filename: "DataSet-Obras-Publicas 31-10-2026",
  fileDate: "2026-10-31",
};

/** A source that serves records from memory; the "file" has a fixed Content-Length. */
export class FakeInfobrasSource implements InfobrasSource {
  downloads = 0;
  skippedDownloads = 0;
  cleanups = 0;

  constructor(
    private readonly link: InfobrasDataSetLink,
    private readonly rows: readonly InfobrasRecord[],
    private readonly contentLength = 57_378_068,
  ) {}

  async latestDataSet(): Promise<InfobrasDataSetLink> {
    return this.link;
  }

  async download(_link: InfobrasDataSetLink, options: { skipIfLength?: number | null } = {}): Promise<DownloadedDataSet | null> {
    if (options.skipIfLength != null && options.skipIfLength === this.contentLength) {
      this.skippedDownloads++;
      return null;
    }
    this.downloads++;
    return {
      path: "/tmp/fake.xlsx",
      bytes: this.contentLength,
      cleanup: async () => {
        this.cleanups++;
      },
    };
  }

  async *records(_path: string): AsyncIterable<InfobrasRecord> {
    yield* this.rows;
  }
}

/** Keeps obras by code and rejects duplicate codes within one call, like Postgres. */
export class InMemoryInfobrasRepository implements InfobrasRepository {
  readonly works = new Map<number, InfobrasWork>();
  readonly removed = new Set<number>();
  readonly snapshots = new Map<string, InfobrasSnapshot>();
  readonly batchSizes: number[] = [];
  readonly checks: Array<{ source: string; checkedAt: string }> = [];

  async getSnapshot(source: string): Promise<InfobrasSnapshot | null> {
    return this.snapshots.get(source) ?? null;
  }

  async upsertWorks(rows: readonly InfobrasWork[]): Promise<number> {
    const codes = rows.map((row) => row.infobrasCode);
    if (new Set(codes).size !== codes.length) throw new Error("ON CONFLICT DO UPDATE command cannot affect row a second time");
    this.batchSizes.push(rows.length);
    let written = 0;
    for (const row of rows) {
      const current = this.works.get(row.infobrasCode);
      if (current === undefined || JSON.stringify(current) !== JSON.stringify(row) || this.removed.has(row.infobrasCode)) {
        written++;
      }
      this.works.set(row.infobrasCode, row);
      this.removed.delete(row.infobrasCode);
    }
    return written;
  }

  async markRemoved(presentCodes: readonly number[]): Promise<number> {
    const present = new Set(presentCodes);
    let marked = 0;
    for (const code of this.works.keys()) {
      if (!present.has(code) && !this.removed.has(code)) {
        this.removed.add(code);
        marked++;
      }
    }
    return marked;
  }

  refreshes = 0;

  async refreshContractorTotals(): Promise<void> {
    this.refreshes++;
  }

  async recordSnapshot(snapshot: InfobrasSnapshot): Promise<void> {
    this.snapshots.set(snapshot.source, snapshot);
  }

  async markChecked(source: string, checkedAt: string): Promise<void> {
    this.checks.push({ source, checkedAt });
    const snapshot = this.snapshots.get(source);
    if (snapshot) this.snapshots.set(source, { ...snapshot, checkedAt });
  }
}
