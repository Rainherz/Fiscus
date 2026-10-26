import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Investment } from "../domain/investment.js";
import type { IngestRun, InvestmentRepository } from "../ports/InvestmentRepository.js";

/** Dry-run repository: writes normalized investments to `investments-<dept>.json` files. */
export class JsonFileInvestmentRepository implements InvestmentRepository {
  private readonly byDepartment = new Map<number, Investment[]>();

  constructor(private readonly outputDir: string) {}

  async upsertInvestments(investments: readonly Investment[]): Promise<number> {
    await mkdir(this.outputDir, { recursive: true });
    const touched = new Set<number>();
    for (const investment of investments) {
      const list = this.byDepartment.get(investment.departmentCode) ?? [];
      list.push(investment);
      this.byDepartment.set(investment.departmentCode, list);
      touched.add(investment.departmentCode);
    }
    for (const code of touched) {
      const file = join(this.outputDir, `investments-${String(code).padStart(2, "0")}.json`);
      await writeFile(file, JSON.stringify(this.byDepartment.get(code), null, 2));
    }
    return investments.length;
  }

  async recordRun(run: IngestRun): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });
    await writeFile(join(this.outputDir, "run.json"), JSON.stringify(run, null, 2));
  }
}
