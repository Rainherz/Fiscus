import type { Investment } from "../../src/domain/investment.js";
import type { IngestRun, InvestmentRepository } from "../../src/ports/InvestmentRepository.js";
import type { InvestmentSource, SourceReport } from "../../src/ports/InvestmentSource.js";

export class InMemoryInvestmentRepository implements InvestmentRepository {
  readonly investments = new Map<string, Investment>();
  readonly runs: IngestRun[] = [];
  upsertCalls = 0;
  failOnDepartment: number | null = null;

  async upsertInvestments(investments: readonly Investment[]): Promise<number> {
    this.upsertCalls++;
    if (investments.some((i) => i.departmentCode === this.failOnDepartment)) {
      throw new Error("db unavailable");
    }
    for (const investment of investments) this.investments.set(investment.cui, investment);
    return investments.length;
  }

  async recordRun(run: IngestRun): Promise<void> {
    this.runs.push(run);
  }
}

export class FakeInvestmentSource implements InvestmentSource {
  readonly requested: number[] = [];

  constructor(private readonly reports: Record<number, SourceReport | Error>) {}

  async fetchDepartment(departmentCode: number): Promise<SourceReport> {
    this.requested.push(departmentCode);
    const report = this.reports[departmentCode];
    if (report === undefined) throw new Error(`no fake report for ${departmentCode}`);
    if (report instanceof Error) throw report;
    return report;
  }
}
