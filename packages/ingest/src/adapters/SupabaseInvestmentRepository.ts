import { createClient } from "@supabase/supabase-js";
import type { Investment } from "../domain/investment.js";
import type { IngestRun, InvestmentRepository } from "../ports/InvestmentRepository.js";

type DbResult = PromiseLike<{ error: { message: string } | null }>;

/** The minimal slice of the Supabase client this adapter relies on. */
export interface TableClient {
  from(table: string): {
    upsert(rows: object[], options?: { onConflict?: string }): DbResult;
    insert(rows: object[]): DbResult;
  };
}

export interface SupabaseRepositoryOptions {
  chunkSize?: number;
}

/**
 * Investment -> `investments` row. Metrics are omitted: they are generated columns in Postgres.
 * data_source = 'ssi' claims the row for the SSI: the open-data ingest then leaves the SSI columns
 * alone (see supabase/migrations/20261031000000_open_data_investments.sql).
 */
export function toInvestmentRow(investment: Investment) {
  return {
    cui: investment.cui,
    snip_code: investment.snipCode,
    name: investment.name,
    // The report is requested with tipo "GR", so every row is a regional-government investment.
    government_level: investment.governmentLevel ?? "GR",
    sector: investment.sector,
    entity: investment.entity,
    status: investment.status,
    situation: investment.situation,
    beneficiaries: investment.beneficiaries,
    registered_at: investment.registeredAt,
    viability_at: investment.viabilityAt,
    investment_type: investment.investmentType,
    function: investment.function,
    functional_division: investment.functionalDivision,
    functional_group: investment.functionalGroup,
    framework: investment.framework,
    viable_amount: investment.viableAmount,
    pim: investment.pim,
    pim_year: investment.pimYear,
    accrued_year: investment.accruedYear,
    first_accrual_month: investment.firstAccrualMonth,
    last_accrual_month: investment.lastAccrualMonth,
    accrued_total: investment.accruedTotal,
    updated_cost: investment.updatedCost,
    dispute_cost: investment.disputeCost,
    guarantee_amount: investment.guaranteeAmount,
    concurrent_control_cost: investment.concurrentControlCost,
    department_code: investment.departmentCode,
    department_name: investment.departmentName,
    source_updated_at: investment.sourceUpdatedAt,
    data_source: "ssi",
  };
}

export class SupabaseInvestmentRepository implements InvestmentRepository {
  private readonly chunkSize: number;

  constructor(
    private readonly client: TableClient,
    options: SupabaseRepositoryOptions = {},
  ) {
    this.chunkSize = options.chunkSize ?? 500;
  }

  /** Builds a repository authenticated with the service role key (bypasses RLS; server-side only). */
  static fromCredentials(url: string, serviceRoleKey: string): SupabaseInvestmentRepository {
    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return new SupabaseInvestmentRepository(client as unknown as TableClient);
  }

  async upsertInvestments(investments: readonly Investment[]): Promise<number> {
    let written = 0;
    for (let start = 0; start < investments.length; start += this.chunkSize) {
      const rows = investments.slice(start, start + this.chunkSize).map(toInvestmentRow);
      const { error } = await this.client.from("investments").upsert(rows, { onConflict: "cui" });
      if (error) throw new Error(`investments upsert failed: ${error.message}`);
      written += rows.length;
    }
    return written;
  }

  async recordRun(run: IngestRun): Promise<void> {
    const { error } = await this.client.from("ingest_runs").insert([
      {
        started_at: run.startedAt,
        finished_at: run.finishedAt,
        departments_ok: run.departmentsOk,
        departments_failed: run.departmentsFailed,
        rows_upserted: run.rowsUpserted,
        rows_skipped: run.rowsSkipped,
      },
    ]);
    if (error) throw new Error(`ingest_runs insert failed: ${error.message}`);
  }
}
