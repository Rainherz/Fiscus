import { appendFile, writeFile } from "node:fs/promises";
import type { InfobrasWork } from "../domain/infobrasWorks.js";
import type { InfobrasRepository, InfobrasSnapshot } from "../ports/InfobrasRepository.js";
import { toInfobrasRow } from "./SupabaseInfobrasRepository.js";

/**
 * Dry-run repository: writes nothing to the database and never finds a snapshot (every run
 * downloads). With an output file it appends the exact rows the Supabase repository would send
 * (NDJSON).
 */
export class DryRunInfobrasRepository implements InfobrasRepository {
  private started = false;

  constructor(private readonly outputFile?: string) {}

  async getSnapshot(_source: string): Promise<InfobrasSnapshot | null> {
    return null;
  }

  async upsertWorks(rows: readonly InfobrasWork[]): Promise<number> {
    if (this.outputFile) {
      const lines = rows.map((row) => `${JSON.stringify(toInfobrasRow(row))}\n`).join("");
      if (this.started) await appendFile(this.outputFile, lines);
      else await writeFile(this.outputFile, lines);
      this.started = true;
    }
    return rows.length;
  }

  async markRemoved(_presentCodes: readonly number[]): Promise<number> {
    return 0;
  }

  async refreshContractorTotals(): Promise<void> {}

  async recordSnapshot(_snapshot: InfobrasSnapshot): Promise<void> {}

  async markChecked(_source: string, _checkedAt: string): Promise<void> {}
}
