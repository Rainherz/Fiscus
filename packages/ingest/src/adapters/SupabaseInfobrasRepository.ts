import { createClient } from "@supabase/supabase-js";
import type { InfobrasWork } from "../domain/infobrasWorks.js";
import type { InfobrasRepository, InfobrasSnapshot } from "../ports/InfobrasRepository.js";

type DbError = { message: string } | null;

/** The minimal slice of the Supabase client this adapter relies on. */
export interface InfobrasClient {
  rpc(fn: string, args: object): PromiseLike<{ data: unknown; error: DbError }>;
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

/** InfobrasWork -> a row of upsert_infobras_works (every stored column but removed_at). */
export function toInfobrasRow(work: InfobrasWork) {
  return {
    infobras_code: work.infobrasCode,
    paralysis_days: work.paralysisDays,
    extension_days: work.extensionDays,
    progress_period: work.progressPeriod,
    progress_registered_at: work.progressRegisteredAt,
    paralysis_date: work.paralysisDate,
    reception_date: work.receptionDate,
    liquidation_date: work.liquidationDate,
    has_paralysis: work.hasParalysis,
    cui: work.cui,
    snip: work.snip,
    execution_status: work.executionStatus,
    paralysis_cause: work.paralysisCause,
    physical_progress_planned: work.physicalProgressPlanned,
    physical_progress_actual: work.physicalProgressActual,
    contract_amount: work.contractAmount,
    expediente_cost_soles: work.expedienteCostSoles,
    additional_works_amount: work.additionalWorksAmount,
    deductions_amount: work.deductionsAmount,
    modality: work.modality,
    contractor_kind: work.contractorKind,
    contractor_ruc: work.contractorRuc,
    contractor_name: work.contractorName,
    supervisor_kind: work.supervisorKind,
    supervisor_ruc: work.supervisorRuc,
    supervisor_name: work.supervisorName,
  };
}

const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class SupabaseInfobrasRepository implements InfobrasRepository {
  constructor(private readonly client: InfobrasClient) {}

  /** Builds a repository authenticated with the service role key (server-side only). */
  static fromCredentials(url: string, serviceRoleKey: string): SupabaseInfobrasRepository {
    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return new SupabaseInfobrasRepository(client as unknown as InfobrasClient);
  }

  async getSnapshot(source: string): Promise<InfobrasSnapshot | null> {
    const { data, error } = await this.client
      .from("source_snapshots")
      .select("source, edition_url, content_length, data_as_of, ingested_at, checked_at, rows_upserted")
      .eq("source", source)
      .maybeSingle();
    if (error) throw new Error(`source_snapshots read failed: ${error.message}`);
    if (data === null) return null;
    return {
      source: String(data.source),
      fileUrl: textOrNull(data.edition_url),
      contentLength: numberOrNull(data.content_length),
      dataAsOf: textOrNull(data.data_as_of),
      ingestedAt: String(data.ingested_at),
      checkedAt: String(data.checked_at ?? data.ingested_at),
      rowsUpserted: numberOrNull(data.rows_upserted) ?? 0,
    };
  }

  async upsertWorks(rows: readonly InfobrasWork[]): Promise<number> {
    if (rows.length === 0) return 0;
    const { data, error } = await this.client.rpc("upsert_infobras_works", { rows: rows.map(toInfobrasRow) });
    if (error) throw new Error(`upsert_infobras_works failed: ${error.message}`);
    return numberOrNull(data) ?? rows.length;
  }

  async markRemoved(presentCodes: readonly number[]): Promise<number> {
    const { data, error } = await this.client.rpc("mark_removed_infobras_works", { codes: presentCodes });
    if (error) throw new Error(`mark_removed_infobras_works failed: ${error.message}`);
    return numberOrNull(data) ?? 0;
  }

  async refreshContractorTotals(): Promise<void> {
    const { error } = await this.client.rpc("refresh_contractor_totals", {});
    if (error) throw new Error(`refresh_contractor_totals failed: ${error.message}`);
  }

  async recordSnapshot(snapshot: InfobrasSnapshot): Promise<void> {
    const { error } = await this.client.from("source_snapshots").upsert(
      [
        {
          source: snapshot.source,
          // The download URL carries the file name; the Content-Length identifies the content.
          edition_url: snapshot.fileUrl,
          content_length: snapshot.contentLength,
          data_as_of: snapshot.dataAsOf,
          last_modified: null,
          edition_cutoff: null,
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
