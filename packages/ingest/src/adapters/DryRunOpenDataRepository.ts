import { appendFile, writeFile } from "node:fs/promises";
import type { OpenDataInvestment } from "../domain/openData.js";
import type { OpenDataRepository, SourceSnapshot } from "../ports/OpenDataRepository.js";
import { toOpenDataRow } from "./SupabaseOpenDataRepository.js";

/**
 * Dry-run repository: writes nothing to the database. With an output file it appends the exact
 * rows the Supabase repository would send, one JSON object per line (NDJSON).
 */
export class DryRunOpenDataRepository implements OpenDataRepository {
  private started = false;

  constructor(private readonly outputFile?: string) {}

  async getSnapshot(_source: string): Promise<SourceSnapshot | null> {
    return null;
  }

  async upsertOpenDataInvestments(rows: readonly OpenDataInvestment[]): Promise<number> {
    if (this.outputFile) {
      const lines = rows.map((row) => `${JSON.stringify(toOpenDataRow(row))}\n`).join("");
      if (this.started) await appendFile(this.outputFile, lines);
      else await writeFile(this.outputFile, lines);
      this.started = true;
    }
    return rows.length;
  }

  async recordSnapshot(_snapshot: SourceSnapshot): Promise<void> {}

  async markChecked(_source: string, _checkedAt: string): Promise<void> {}
}
