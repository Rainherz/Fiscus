import type { Investment } from "../domain/investment.js";

export interface IngestRun {
  startedAt: string;
  finishedAt: string;
  departmentsOk: number[];
  departmentsFailed: number[];
  rowsUpserted: number;
  rowsSkipped: number;
}

export interface InvestmentRepository {
  /** Inserts or updates by CUI. Returns the number of rows written. */
  upsertInvestments(investments: readonly Investment[]): Promise<number>;
  recordRun(run: IngestRun): Promise<void>;
}
