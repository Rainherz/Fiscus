import { createClient } from "@supabase/supabase-js";
import type { ParalyzedWork } from "../domain/paralyzedWorks.js";
import type { EditionSnapshot, ParalyzedWorksRepository } from "../ports/ParalyzedWorksRepository.js";

type DbError = { message: string } | null;

/** The minimal slice of the Supabase client this adapter relies on. */
export interface ParalyzedClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: DbError }>;
      };
    };
    upsert(rows: object[], options?: { onConflict?: string }): PromiseLike<{ error: DbError }>;
    update(values: object): {
      eq(column: string, value: string): PromiseLike<{ error: DbError }>;
    };
  };
}

/** ParalyzedWork -> a row of public.official_paralyzed_works (every column but ingested_at). */
export function toParalyzedRow(work: ParalyzedWork) {
  return {
    edition_cutoff: work.editionCutoff,
    published_at: work.publishedAt,
    infobras_code: work.infobrasCode,
    cui: work.cui,
    snip: work.snip,
    investment_description: work.investmentDescription,
    obra_description: work.obraDescription,
    entity: work.entity,
    government_level: work.governmentLevel,
    sector: work.sector,
    department_code: work.departmentCode,
    department: work.department,
    province: work.province,
    district: work.district,
    event: work.event,
    modality: work.modality,
    work_type: work.workType,
    causal_code: work.causalCode,
    causal_label: work.causalLabel,
    physical_progress: work.physicalProgress,
    expediente_cost: work.expedienteCost,
    remaining_work_balance: work.remainingWorkBalance,
    updated_cost: work.updatedCost,
    investment_balance: work.investmentBalance,
    start_year: work.startYear,
    execution_days: work.executionDays,
    mef_inventory: work.mefInventory,
    mef_inventory_registered_at: work.mefInventoryRegisteredAt,
    situational_report_at: work.situationalReportAt,
    mef_report_url: work.mefReportUrl,
    prioritized: work.prioritized,
    prioritized_resolution_at: work.prioritizedResolutionAt,
    prioritized_resolution_url: work.prioritizedResolutionUrl,
  };
}

const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);

export class SupabaseParalyzedWorksRepository implements ParalyzedWorksRepository {
  constructor(private readonly client: ParalyzedClient) {}

  /** Builds a repository authenticated with the service role key (server-side only). */
  static fromCredentials(url: string, serviceRoleKey: string): SupabaseParalyzedWorksRepository {
    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return new SupabaseParalyzedWorksRepository(client as unknown as ParalyzedClient);
  }

  async getEditionSnapshot(source: string): Promise<EditionSnapshot | null> {
    const { data, error } = await this.client
      .from("source_snapshots")
      .select("source, edition_cutoff, edition_url, ingested_at, checked_at, rows_upserted")
      .eq("source", source)
      .maybeSingle();
    if (error) throw new Error(`source_snapshots read failed: ${error.message}`);
    if (data === null) return null;
    const rows = Number(data.rows_upserted);
    return {
      source: String(data.source),
      editionCutoff: textOrNull(data.edition_cutoff),
      editionUrl: textOrNull(data.edition_url),
      ingestedAt: String(data.ingested_at),
      checkedAt: String(data.checked_at ?? data.ingested_at),
      rowsUpserted: Number.isFinite(rows) ? rows : 0,
    };
  }

  async upsertParalyzedWorks(rows: readonly ParalyzedWork[]): Promise<number> {
    if (rows.length === 0) return 0;
    const { error } = await this.client
      .from("official_paralyzed_works")
      .upsert(rows.map(toParalyzedRow), { onConflict: "edition_cutoff,infobras_code" });
    if (error) throw new Error(`official_paralyzed_works upsert failed: ${error.message}`);
    return rows.length;
  }

  async recordEditionSnapshot(snapshot: EditionSnapshot): Promise<void> {
    const { error } = await this.client.from("source_snapshots").upsert(
      [
        {
          source: snapshot.source,
          edition_cutoff: snapshot.editionCutoff,
          edition_url: snapshot.editionUrl,
          // Not an HTTP-identified file: the edition URL plays that role.
          last_modified: null,
          content_length: null,
          ingested_at: snapshot.ingestedAt,
          checked_at: snapshot.checkedAt,
          rows_upserted: snapshot.rowsUpserted,
        },
      ],
      { onConflict: "source" },
    );
    if (error) throw new Error(`source_snapshots upsert failed: ${error.message}`);
  }

  async markChecked(source: string, checkedAt: string): Promise<void> {
    const { error } = await this.client.from("source_snapshots").update({ checked_at: checkedAt }).eq("source", source);
    if (error) throw new Error(`source_snapshots check update failed: ${error.message}`);
  }
}
