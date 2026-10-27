import type { CostChange, RecentCostIncrease } from '../domain/costChange';
import type { FunctionSummary, IngestRun, Investment } from '../domain/investment';
import type { InvestmentQuery } from '../domain/queries';
import type { RegionComparison } from '../domain/regionComparison';
import type { StalledInvestment } from '../domain/stalled';

/** Read-only access to public investment data. */
export interface InvestmentsRepository {
  findMany(query: InvestmentQuery): Promise<Investment[]>;
  findByCui(cui: string): Promise<Investment | null>;
  /** Function aggregates for one department, largest current cost first. */
  functionSummaries(departmentCode: number): Promise<FunctionSummary[]>;
  lastIngestRun(): Promise<IngestRun | null>;
  /** Recorded cost values of one investment, oldest first. */
  getCostHistory(cui: string): Promise<CostChange[]>;
  /** Recorded increases of the updated cost in one department, newest first. */
  getRecentCostIncreases(params: { departmentCode: number; limit: number }): Promise<RecentCostIncrease[]>;
  /** "Sin gasto reciente" in one department, largest amount not yet spent first (see domain/stalled). */
  getStalledInvestments(params: {
    departmentCode: number;
    page: number;
    pageSize?: number;
  }): Promise<StalledInvestment[]>;
  countStalledInvestments(departmentCode: number): Promise<number>;
  /** Latest last accrual month in the dataset (first day of a month), or null without data. */
  getAccrualReferenceMonth(): Promise<string | null>;
  /** One row per department with data, ordered by department code (see domain/regionComparison). */
  getRegionComparison(): Promise<RegionComparison[]>;
}
