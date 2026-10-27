import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DryRunOpenDataRepository } from "../../src/adapters/DryRunOpenDataRepository.js";
import {
  SupabaseOpenDataRepository,
  toOpenDataRow,
  type OpenDataClient,
} from "../../src/adapters/SupabaseOpenDataRepository.js";
import { mapOpenDataRecord, type OpenDataInvestment } from "../../src/domain/openData.js";

const MIGRATION = fileURLToPath(
  new URL("../../../../supabase/migrations/20261031000000_open_data_investments.sql", import.meta.url),
);

function investment(cui: string): OpenDataInvestment {
  const mapped = mapOpenDataRecord(
    {
      CODIGO_UNICO: cui,
      NIVEL: "GL",
      ALTERNATIVA: "free text, never stored",
      MONTO_VIABLE: "1000.0",
      COSTO_ACTUALIZADO: "2000.0",
      DEVEN_ACUMUL_ANIO_ANT: "10",
      DEV_ANIO_ACTUAL: "5",
      UBIGEO: "080101",
      LATITUD: "-13.5",
      LONGITUD: "-71.9",
      FECHA_REGISTRO: "2020-01-02 00:00:00",
      ULTIMO_DEVENGADO: "202610",
    },
    { sourceUpdatedAt: "2026-10-25T18:31:25.000Z", seenAt: "2026-10-26T10:00:00.000Z" },
  );
  if (!mapped) throw new Error("fixture must have a CUI");
  return mapped;
}

/** Column list of jsonb_to_recordset(...) as r (...) in the migration: the database whitelist. */
async function functionColumns(): Promise<string[]> {
  const sql = await readFile(MIGRATION, "utf8");
  const match = /jsonb_to_recordset\(rows\) as r \(([\s\S]*?)\n  \)/.exec(sql);
  if (!match) throw new Error("recordset definition not found in the migration");
  return match[1]!
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0]!)
    .filter(Boolean);
}

const GENERATED_COLUMNS = [
  "cost_increase",
  "cost_increase_pct",
  "execution_progress",
  "updated_cost_valid",
  "spent_anomaly",
];

describe("toOpenDataRow", () => {
  it("sends exactly the columns upsert_open_data_investments accepts", async () => {
    expect(Object.keys(toOpenDataRow(investment("1"))).sort()).toEqual((await functionColumns()).sort());
  });

  it("never sends generated columns, data_source or ALTERNATIVA", () => {
    const row = toOpenDataRow(investment("1"));
    for (const column of [...GENERATED_COLUMNS, "data_source", "alternativa", "alternative"]) {
      expect(row).not.toHaveProperty(column);
    }
    expect(JSON.stringify(row)).not.toContain("free text");
  });

  it("maps to snake_case values", () => {
    expect(toOpenDataRow(investment("1"))).toMatchObject({
      cui: "1",
      government_level: "GL",
      viable_amount: 1000,
      updated_cost: 2000,
      accrued_previous_years: 10,
      accrued_year: 5,
      accrued_total: 15,
      registered_at: "2020-01-02",
      last_accrual_month: "2026-10-01",
      department_code: 8,
      department_name: "Cusco",
      ubigeo: "080101",
      latitude: -13.5,
      longitude: -71.9,
      source_updated_at: "2026-10-25T18:31:25.000Z",
      source_seen_at: "2026-10-26T10:00:00.000Z",
    });
  });
});

class FakeClient implements OpenDataClient {
  readonly rpcCalls: Array<{ fn: string; rows: unknown[] }> = [];
  readonly upserts: Array<{ table: string; rows: unknown[]; options?: unknown }> = [];
  readonly selects: Array<{ table: string; column: string; value: string }> = [];
  snapshotRow: Record<string, unknown> | null = null;
  rpcError: string | null = null;

  async rpc(fn: string, args: { rows: unknown[] }) {
    this.rpcCalls.push({ fn, rows: args.rows });
    return this.rpcError
      ? { data: null, error: { message: this.rpcError } }
      : { data: args.rows.length, error: null };
  }

  from(table: string) {
    return {
      select: (_columns: string) => ({
        eq: (column: string, value: string) => ({
          maybeSingle: async () => {
            this.selects.push({ table, column, value });
            return { data: this.snapshotRow, error: null };
          },
        }),
      }),
      upsert: async (rows: object[], options?: { onConflict?: string }) => {
        this.upserts.push({ table, rows, options });
        return { error: null };
      },
    };
  }
}

describe("SupabaseOpenDataRepository", () => {
  it("calls upsert_open_data_investments with whitelisted rows", async () => {
    const client = new FakeClient();
    const repository = new SupabaseOpenDataRepository(client);

    await expect(repository.upsertOpenDataInvestments([investment("1"), investment("2")])).resolves.toBe(2);

    expect(client.rpcCalls).toHaveLength(1);
    expect(client.rpcCalls[0]!.fn).toBe("upsert_open_data_investments");
    expect(client.rpcCalls[0]!.rows).toEqual([toOpenDataRow(investment("1")), toOpenDataRow(investment("2"))]);
  });

  it("throws with the database message when the upsert fails", async () => {
    const client = new FakeClient();
    client.rpcError = "statement timeout";
    await expect(new SupabaseOpenDataRepository(client).upsertOpenDataInvestments([investment("1")])).rejects.toThrow(
      /statement timeout/,
    );
  });

  it("does not call the database for an empty batch", async () => {
    const client = new FakeClient();
    await expect(new SupabaseOpenDataRepository(client).upsertOpenDataInvestments([])).resolves.toBe(0);
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("reads a snapshot by source", async () => {
    const client = new FakeClient();
    client.snapshotRow = {
      source: "mef_detalle_inversiones",
      last_modified: "2026-10-25T18:31:25+00:00",
      content_length: 247423895,
      ingested_at: "2026-10-26T10:00:00+00:00",
      rows_upserted: 150290,
    };

    await expect(new SupabaseOpenDataRepository(client).getSnapshot("mef_detalle_inversiones")).resolves.toEqual({
      source: "mef_detalle_inversiones",
      lastModified: "2026-10-25T18:31:25+00:00",
      contentLength: 247423895,
      ingestedAt: "2026-10-26T10:00:00+00:00",
      rowsUpserted: 150290,
    });
    expect(client.selects).toEqual([{ table: "source_snapshots", column: "source", value: "mef_detalle_inversiones" }]);
  });

  it("returns null when there is no snapshot", async () => {
    await expect(new SupabaseOpenDataRepository(new FakeClient()).getSnapshot("x")).resolves.toBeNull();
  });

  it("upserts the snapshot by source", async () => {
    const client = new FakeClient();
    await new SupabaseOpenDataRepository(client).recordSnapshot({
      source: "mef_detalle_inversiones",
      lastModified: "2026-10-25T18:31:25.000Z",
      contentLength: 247423895,
      ingestedAt: "2026-10-26T10:00:00.000Z",
      rowsUpserted: 150290,
    });

    expect(client.upserts).toEqual([
      {
        table: "source_snapshots",
        rows: [
          {
            source: "mef_detalle_inversiones",
            last_modified: "2026-10-25T18:31:25.000Z",
            content_length: 247423895,
            ingested_at: "2026-10-26T10:00:00.000Z",
            rows_upserted: 150290,
          },
        ],
        options: { onConflict: "source" },
      },
    ]);
  });
});

describe("DryRunOpenDataRepository", () => {
  it("never reports a snapshot and counts rows without writing anywhere", async () => {
    const repository = new DryRunOpenDataRepository();
    await expect(repository.getSnapshot("x")).resolves.toBeNull();
    await expect(repository.upsertOpenDataInvestments([investment("1")])).resolves.toBe(1);
    await repository.recordSnapshot({ source: "x", lastModified: null, contentLength: null, ingestedAt: "t", rowsUpserted: 1 });
  });

  it("appends the exact rows it would send as NDJSON when given a file", async () => {
    const file = join(await mkdtemp(join(tmpdir(), "fiscus-od-")), "rows.ndjson");
    const repository = new DryRunOpenDataRepository(file);

    await repository.upsertOpenDataInvestments([investment("1")]);
    await repository.upsertOpenDataInvestments([investment("2")]);

    const lines = (await readFile(file, "utf8")).trim().split("\n");
    expect(lines.map((line) => JSON.parse(line))).toEqual([toOpenDataRow(investment("1")), toOpenDataRow(investment("2"))]);
  });
});
