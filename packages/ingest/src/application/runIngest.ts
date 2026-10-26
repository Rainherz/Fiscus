import { normalizeInvestment, type Investment } from "../domain/investment.js";
import type { InvestmentRepository } from "../ports/InvestmentRepository.js";
import type { InvestmentSource } from "../ports/InvestmentSource.js";

export interface DepartmentResult {
  departmentCode: number;
  ok: boolean;
  rows: number;
  skipped: number;
  duplicates: number;
  error?: string;
}

export interface IngestSummary {
  startedAt: string;
  finishedAt: string;
  departmentsOk: number[];
  departmentsFailed: number[];
  rowsUpserted: number;
  /** Rows dropped because they had no CUI. */
  rowsSkipped: number;
  /** Rows dropped because their CUI repeated within the same department (last one wins). */
  duplicatesDropped: number;
  allFailed: boolean;
  results: DepartmentResult[];
}

export interface RunIngestInput {
  source: InvestmentSource;
  repository: InvestmentRepository;
  departments: readonly number[];
  now?: () => Date;
  log?: (message: string) => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function ingestDepartment(
  departmentCode: number,
  source: InvestmentSource,
  repository: InvestmentRepository,
): Promise<DepartmentResult> {
  const report = await source.fetchDepartment(departmentCode);
  const byCui = new Map<string, Investment>();
  let skipped = 0;
  let duplicates = 0;
  for (const record of report.records) {
    const investment = normalizeInvestment(record, {
      departmentCode,
      sourceUpdatedAt: report.sourceUpdatedAt,
      pimYear: report.pimYear,
    });
    if (investment === null) {
      skipped++;
      continue;
    }
    if (byCui.has(investment.cui)) duplicates++;
    byCui.set(investment.cui, investment);
  }
  const rows = await repository.upsertInvestments([...byCui.values()]);
  return { departmentCode, ok: true, rows, skipped, duplicates };
}

/** Ingests departments one at a time; a failing department never aborts the run. */
export async function runIngest({
  source,
  repository,
  departments,
  now = () => new Date(),
  log = console.log,
}: RunIngestInput): Promise<IngestSummary> {
  const startedAt = now().toISOString();
  const results: DepartmentResult[] = [];

  for (const departmentCode of departments) {
    try {
      const result = await ingestDepartment(departmentCode, source, repository);
      results.push(result);
      log(
        `department ${departmentCode}: ${result.rows} rows upserted, ${result.skipped} skipped (no CUI), ${result.duplicates} duplicates`,
      );
    } catch (error) {
      results.push({ departmentCode, ok: false, rows: 0, skipped: 0, duplicates: 0, error: errorMessage(error) });
      log(`department ${departmentCode}: FAILED - ${errorMessage(error)}`);
    }
  }

  const ok = results.filter((r) => r.ok);
  const summary: IngestSummary = {
    startedAt,
    finishedAt: now().toISOString(),
    departmentsOk: ok.map((r) => r.departmentCode),
    departmentsFailed: results.filter((r) => !r.ok).map((r) => r.departmentCode),
    rowsUpserted: ok.reduce((sum, r) => sum + r.rows, 0),
    rowsSkipped: ok.reduce((sum, r) => sum + r.skipped, 0),
    duplicatesDropped: ok.reduce((sum, r) => sum + r.duplicates, 0),
    allFailed: departments.length > 0 && ok.length === 0,
    results,
  };

  try {
    await repository.recordRun({
      startedAt: summary.startedAt,
      finishedAt: summary.finishedAt,
      departmentsOk: summary.departmentsOk,
      departmentsFailed: summary.departmentsFailed,
      rowsUpserted: summary.rowsUpserted,
      rowsSkipped: summary.rowsSkipped,
    });
  } catch (error) {
    log(`warning: could not record ingest run - ${errorMessage(error)}`);
  }

  return summary;
}
