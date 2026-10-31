import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DryRunInfobrasRepository } from "../../src/adapters/DryRunInfobrasRepository.js";
import {
  SupabaseInfobrasRepository,
  toInfobrasRow,
  type InfobrasClient,
} from "../../src/adapters/SupabaseInfobrasRepository.js";
import { mapInfobrasRecord, type InfobrasWork } from "../../src/domain/infobrasWorks.js";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../../supabase/migrations/", import.meta.url));

function work(code: number, ruc = "20301552115"): InfobrasWork {
  const mapped = mapInfobrasRecord({
    "Código INFOBRAS": String(code),
    "Codigo unico de inversión": "2132947",
    "Estado de ejecución": "En Ejecución",
    "RUC (Ejecución)": ruc,
    "Nombre o razón social de la empresa o consorcio": "JUAN PEREZ",
    "Monto del contrato en soles": "3158683 99",
    "Costo de obra en soles según ET en soles": "3280120 5",
  });
  if (!mapped) throw new Error("fixture must have an INFOBRAS code");
  return mapped;
}

/** Every migration, in the order they are applied. */
async function migrations(): Promise<string[]> {
  const names = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith(".sql")).sort();
  return Promise.all(names.map((name) => readFile(join(MIGRATIONS_DIR, name), "utf8")));
}

/**
 * Stored columns of public.infobras_works after every migration: `create table (...)` plus each
 * `add column`, without constraints and without generated columns (the database computes those).
 */
async function tableColumns(): Promise<string[]> {
  const all = (await migrations()).join("\n");
  const body = /create table public\.infobras_works \(([\s\S]*?)\n\);/.exec(all)?.[1];
  if (!body) throw new Error("table not found in the migrations");
  const created = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[a-z_]+\s+(int|date|boolean|text|numeric)\b/.test(line))
    .map((line) => line.split(/\s+/)[0]!);
  const added = [...all.matchAll(/alter table public\.infobras_works\s+add column (\w+)([^;]*);/g)]
    .filter((match) => !/generated always/i.test(match[2]!))
    .map((match) => match[1]!);
  return [...created, ...added];
}

/** The latest definition of upsert_infobras_works. */
async function upsertFunction(): Promise<string> {
  const definitions = (await migrations()).flatMap((sql) =>
    [...sql.matchAll(/function public\.upsert_infobras_works\(rows jsonb\)[\s\S]*?\n\$\$;/g)].map((m) => m[0]),
  );
  const latest = definitions.at(-1);
  if (!latest) throw new Error("upsert_infobras_works not found in the migrations");
  return latest;
}

/** Column list of jsonb_to_recordset(rows) as r (...) in upsert_infobras_works: the database whitelist. */
async function recordsetColumns(): Promise<string[]> {
  const body = /jsonb_to_recordset\(rows\) as r \(([\s\S]*?)\n  \)/.exec(await upsertFunction())?.[1];
  if (!body) throw new Error("recordset not found in upsert_infobras_works");
  return body.split(",").map((part) => part.trim().split(/\s+/)[0]!);
}

/** Columns compared by the no-op skip (`(w.a, w.b, ...) is distinct from (excluded.a, ...)`). */
async function comparedColumns(): Promise<string[]> {
  const body = /or \(([\s\S]*?)\)\s+is distinct from/.exec(await upsertFunction())?.[1];
  if (!body) throw new Error("no-op comparison not found in upsert_infobras_works");
  return body.split(",").map((part) => part.trim().replace(/^w\./, ""));
}

function fakeClient(snapshot: Record<string, unknown> | null = null, rpcData: unknown = 2) {
  const calls: Array<{ op: string; table: string; args: unknown[] }> = [];
  const client: InfobrasClient = {
    async rpc(fn, args) {
      calls.push({ op: "rpc", table: fn, args: [args] });
      return { data: rpcData, error: null };
    },
    from(table) {
      return {
        select(columns) {
          return {
            eq(column, value) {
              return {
                async maybeSingle() {
                  calls.push({ op: "select", table, args: [columns, column, value] });
                  return { data: snapshot, error: null };
                },
              };
            },
          };
        },
        async upsert(rows, options) {
          calls.push({ op: "upsert", table, args: [rows, options] });
          return { error: null };
        },
        update(values) {
          return {
            async eq(column, value) {
              calls.push({ op: "update", table, args: [values, column, value] });
              return { error: null };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

describe("toInfobrasRow", () => {
  it("sends exactly the RPC's whitelist, which is every table column but removed_at", async () => {
    const keys = Object.keys(toInfobrasRow(work(1))).sort();
    expect(keys).toEqual([...(await recordsetColumns())].sort());
    expect(keys).toEqual((await tableColumns()).filter((c) => c !== "removed_at").sort());
  });

  it("sends the expediente cost, and the no-op skip compares every column it sends", async () => {
    const row = toInfobrasRow(work(1));
    expect(row).toMatchObject({ contract_amount: 3158683.99, expediente_cost_soles: 3280120.5 });
    const sent = Object.keys(row).filter((c) => c !== "infobras_code");
    expect((await comparedColumns()).sort()).toEqual(sent.sort());
  });

  it("never sends a natural person's name or RUC", () => {
    const row = toInfobrasRow(work(1, "10412345678"));
    expect(row).toMatchObject({ contractor_kind: "persona_natural", contractor_ruc: null, contractor_name: null });
    expect(JSON.stringify(row)).not.toMatch(/JUAN|10412345678/);
  });
});

describe("SupabaseInfobrasRepository", () => {
  it("upserts through the RPC and returns the rows it wrote", async () => {
    const { client, calls } = fakeClient(null, 1);
    expect(await new SupabaseInfobrasRepository(client).upsertWorks([work(1), work(2)])).toBe(1);
    expect(calls).toEqual([
      { op: "rpc", table: "upsert_infobras_works", args: [{ rows: [toInfobrasRow(work(1)), toInfobrasRow(work(2))] }] },
    ]);
  });

  it("sends nothing for an empty chunk", async () => {
    const { client, calls } = fakeClient();
    expect(await new SupabaseInfobrasRepository(client).upsertWorks([])).toBe(0);
    expect(calls).toEqual([]);
  });

  it("marks removed obras with the codes the file had", async () => {
    const { client, calls } = fakeClient(null, 3);
    expect(await new SupabaseInfobrasRepository(client).markRemoved([1, 2])).toBe(3);
    expect(calls).toEqual([{ op: "rpc", table: "mark_removed_infobras_works", args: [{ codes: [1, 2] }] }]);
  });

  it("refreshes the contractor totals through the RPC", async () => {
    const { client, calls } = fakeClient(null, null);
    await new SupabaseInfobrasRepository(client).refreshContractorTotals();
    expect(calls).toEqual([{ op: "rpc", table: "refresh_contractor_totals", args: [{}] }]);
  });

  it("reads and records the snapshot", async () => {
    const { client, calls } = fakeClient({
      source: "infobras_obras",
      edition_url: "https://infobras.contraloria.gob.pe/x",
      content_length: "57378068",
      data_as_of: "2026-03-31",
      ingested_at: "2026-11-03T11:00:00+00:00",
      checked_at: null,
      rows_upserted: 191180,
    });
    const repository = new SupabaseInfobrasRepository(client);
    expect(await repository.getSnapshot("infobras_obras")).toEqual({
      source: "infobras_obras",
      fileUrl: "https://infobras.contraloria.gob.pe/x",
      contentLength: 57378068,
      dataAsOf: "2026-03-31",
      ingestedAt: "2026-11-03T11:00:00+00:00",
      checkedAt: "2026-11-03T11:00:00+00:00",
      rowsUpserted: 191180,
    });

    await repository.recordSnapshot({
      source: "infobras_obras",
      fileUrl: "https://infobras.contraloria.gob.pe/y",
      contentLength: 1,
      dataAsOf: "2026-03-31",
      ingestedAt: "a",
      checkedAt: "b",
      rowsUpserted: 5,
    });
    await repository.markChecked("infobras_obras", "c");
    expect(calls.slice(1)).toEqual([
      {
        op: "upsert",
        table: "source_snapshots",
        args: [
          [
            {
              source: "infobras_obras",
              edition_url: "https://infobras.contraloria.gob.pe/y",
              content_length: 1,
              data_as_of: "2026-03-31",
              last_modified: null,
              edition_cutoff: null,
              ingested_at: "a",
              checked_at: "b",
              rows_upserted: 5,
            },
          ],
          { onConflict: "source" },
        ],
      },
      { op: "update", table: "source_snapshots", args: [{ checked_at: "c" }, "source", "infobras_obras"] },
    ]);
  });
});

describe("DryRunInfobrasRepository", () => {
  it("writes the rows it would send as NDJSON and never finds a snapshot", async () => {
    const out = join(await mkdtemp(join(tmpdir(), "infobras-dry-")), "rows.ndjson");
    const repository = new DryRunInfobrasRepository(out);
    expect(await repository.getSnapshot("infobras_obras")).toBeNull();
    await repository.upsertWorks([work(1)]);
    await repository.upsertWorks([work(2)]);
    const lines = (await readFile(out, "utf8")).trim().split("\n");
    expect(lines.map((line) => JSON.parse(line).infobras_code)).toEqual([1, 2]);
  });
});
