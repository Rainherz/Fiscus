import { createClient } from "@supabase/supabase-js";
import type { OpenDataInvestment } from "../domain/openData.js";
import type { OpenDataRepository, SourceSnapshot } from "../ports/OpenDataRepository.js";

type DbError = { message: string } | null;

/** The minimal slice of the Supabase client this adapter relies on. */
export interface OpenDataClient {
  rpc(fn: string, args: { rows: object[] }): PromiseLike<{ data: unknown; error: DbError }>;
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: DbError }>;
      };
    };
    upsert(rows: object[], options?: { onConflict?: string }): PromiseLike<{ error: DbError }>;
  };
}

/**
 * OpenDataInvestment -> argument row of public.upsert_open_data_investments. This is the column
 * whitelist: generated metrics, data_source (set by the function) and every unmapped CSV column
 * (ALTERNATIVA...) are never sent. Keep in sync with the function's recordset definition.
 */
export function toOpenDataRow(investment: OpenDataInvestment) {
  return {
    cui: investment.cui,
    snip_code: investment.snipCode,
    name: investment.name,
    government_level: investment.governmentLevel,
    sector: investment.sector,
    entity: investment.entity,
    executing_unit: investment.executingUnit,
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
    updated_cost: investment.updatedCost,
    pim: investment.pim,
    pim_year: investment.pimYear,
    accrued_year: investment.accruedYear,
    accrued_previous_years: investment.accruedPreviousYears,
    accrued_total: investment.accruedTotal,
    first_accrual_month: investment.firstAccrualMonth,
    last_accrual_month: investment.lastAccrualMonth,
    pending_balance: investment.pendingBalance,
    dispute_cost: investment.disputeCost,
    guarantee_amount: investment.guaranteeAmount,
    concurrent_control_cost: investment.concurrentControlCost,
    physical_progress: investment.physicalProgress,
    department_code: investment.departmentCode,
    department_name: investment.departmentName,
    province: investment.province,
    district: investment.district,
    ubigeo: investment.ubigeo,
    latitude: investment.latitude,
    longitude: investment.longitude,
    source_updated_at: investment.sourceUpdatedAt,
    source_seen_at: investment.sourceSeenAt,
  };
}

function asNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class SupabaseOpenDataRepository implements OpenDataRepository {
  constructor(private readonly client: OpenDataClient) {}

  /** Builds a repository authenticated with the service role key (server-side only). */
  static fromCredentials(url: string, serviceRoleKey: string): SupabaseOpenDataRepository {
    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return new SupabaseOpenDataRepository(client as unknown as OpenDataClient);
  }

  async getSnapshot(source: string): Promise<SourceSnapshot | null> {
    const { data, error } = await this.client
      .from("source_snapshots")
      .select("source, last_modified, content_length, ingested_at, rows_upserted")
      .eq("source", source)
      .maybeSingle();
    if (error) throw new Error(`source_snapshots read failed: ${error.message}`);
    if (data === null) return null;
    return {
      source: String(data.source),
      lastModified: (data.last_modified as string | null) ?? null,
      contentLength: asNumberOrNull(data.content_length),
      ingestedAt: String(data.ingested_at),
      rowsUpserted: asNumberOrNull(data.rows_upserted) ?? 0,
    };
  }

  async upsertOpenDataInvestments(rows: readonly OpenDataInvestment[]): Promise<number> {
    if (rows.length === 0) return 0;
    const { error } = await this.client.rpc("upsert_open_data_investments", { rows: rows.map(toOpenDataRow) });
    if (error) throw new Error(`upsert_open_data_investments failed: ${error.message}`);
    return rows.length;
  }

  async recordSnapshot(snapshot: SourceSnapshot): Promise<void> {
    const { error } = await this.client.from("source_snapshots").upsert(
      [
        {
          source: snapshot.source,
          last_modified: snapshot.lastModified,
          content_length: snapshot.contentLength,
          ingested_at: snapshot.ingestedAt,
          rows_upserted: snapshot.rowsUpserted,
        },
      ],
      { onConflict: "source" },
    );
    if (error) throw new Error(`source_snapshots upsert failed: ${error.message}`);
  }
}
