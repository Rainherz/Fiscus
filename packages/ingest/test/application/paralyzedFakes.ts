import type { ParalyzedRecord, ParalyzedWork } from "../../src/domain/paralyzedWorks.js";
import type { EditionSnapshot, ParalyzedWorksRepository } from "../../src/ports/ParalyzedWorksRepository.js";
import type { ParalyzedEdition, ParalyzedWorksSource } from "../../src/ports/ParalyzedWorksSource.js";

export const JUNE_2026: ParalyzedEdition = {
  title: "Informe de Obras Paralizadas en el Territorio Nacional a junio de 2026",
  url: "https://www.gob.pe/institucion/contraloria/informes-publicaciones/8489152-informe",
  publishedAt: "2026-08-17",
  cutoff: "2026-06-30",
  xlsxUrl: "https://cdn.www.gob.pe/uploads/document/file/10466637/anexo-n-01.XLSX?v=1",
};

export class FakeParalyzedWorksSource implements ParalyzedWorksSource {
  recordsRead = 0;

  constructor(
    private readonly edition: ParalyzedEdition,
    private readonly rows: readonly ParalyzedRecord[],
  ) {}

  async latestEdition(): Promise<ParalyzedEdition> {
    return this.edition;
  }

  async records(_edition: ParalyzedEdition): Promise<ParalyzedRecord[]> {
    this.recordsRead++;
    return [...this.rows];
  }
}

/** Keeps obras by (edition_cutoff, infobras_code); rejects duplicate keys within one call like Postgres. */
export class InMemoryParalyzedWorksRepository implements ParalyzedWorksRepository {
  readonly works = new Map<string, ParalyzedWork>();
  readonly snapshots = new Map<string, EditionSnapshot>();
  readonly batchSizes: number[] = [];
  readonly checks: Array<{ source: string; checkedAt: string }> = [];

  async getEditionSnapshot(source: string): Promise<EditionSnapshot | null> {
    return this.snapshots.get(source) ?? null;
  }

  async upsertParalyzedWorks(rows: readonly ParalyzedWork[]): Promise<number> {
    const keys = rows.map((row) => `${row.editionCutoff}:${row.infobrasCode}`);
    if (new Set(keys).size !== keys.length) throw new Error("ON CONFLICT DO UPDATE command cannot affect row a second time");
    this.batchSizes.push(rows.length);
    rows.forEach((row, index) => this.works.set(keys[index]!, row));
    return rows.length;
  }

  async recordEditionSnapshot(snapshot: EditionSnapshot): Promise<void> {
    this.snapshots.set(snapshot.source, snapshot);
  }

  async markChecked(source: string, checkedAt: string): Promise<void> {
    this.checks.push({ source, checkedAt });
    const snapshot = this.snapshots.get(source);
    if (snapshot) this.snapshots.set(source, { ...snapshot, checkedAt });
  }
}
