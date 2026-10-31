import { appendFile, writeFile } from "node:fs/promises";
import type { ParalyzedWork } from "../domain/paralyzedWorks.js";
import type { EditionSnapshot, ParalyzedWorksRepository } from "../ports/ParalyzedWorksRepository.js";
import { toParalyzedRow } from "./SupabaseParalyzedWorksRepository.js";

/**
 * Dry-run repository: writes nothing to the database and never finds a snapshot (every run ingests).
 * With an output file it appends the exact rows the Supabase repository would send (NDJSON).
 */
export class DryRunParalyzedWorksRepository implements ParalyzedWorksRepository {
  private started = false;

  constructor(private readonly outputFile?: string) {}

  async getEditionSnapshot(_source: string): Promise<EditionSnapshot | null> {
    return null;
  }

  async upsertParalyzedWorks(rows: readonly ParalyzedWork[]): Promise<number> {
    if (this.outputFile) {
      const lines = rows.map((row) => `${JSON.stringify(toParalyzedRow(row))}\n`).join("");
      if (this.started) await appendFile(this.outputFile, lines);
      else await writeFile(this.outputFile, lines);
      this.started = true;
    }
    return rows.length;
  }

  async recordEditionSnapshot(_snapshot: EditionSnapshot): Promise<void> {}

  async markChecked(_source: string, _checkedAt: string): Promise<void> {}
}
