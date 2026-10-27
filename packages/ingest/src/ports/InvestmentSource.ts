import type { RawInvestmentRecord } from "../domain/investment.js";

/** One department's report as extracted from the upstream source, not yet normalized. */
export interface SourceReport {
  sourceUpdatedAt: string | null;
  pimYear: number | null;
  records: RawInvestmentRecord[];
}

export interface InvestmentSource {
  fetchDepartment(departmentCode: number): Promise<SourceReport>;
}
