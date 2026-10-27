import type { FunctionSummary, IngestRun, Investment } from '../domain/investment';
import type { InvestmentQuery } from '../domain/queries';

/** Read-only access to public investment data. */
export interface InvestmentsRepository {
  findMany(query: InvestmentQuery): Promise<Investment[]>;
  findByCui(cui: string): Promise<Investment | null>;
  /** Function aggregates for one department, largest current cost first. */
  functionSummaries(departmentCode: number): Promise<FunctionSummary[]>;
  lastIngestRun(): Promise<IngestRun | null>;
}
