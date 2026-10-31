import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DryRunParalyzedWorksRepository } from "../../src/adapters/DryRunParalyzedWorksRepository.js";
import {
  SupabaseParalyzedWorksRepository,
  toParalyzedRow,
  type ParalyzedClient,
} from "../../src/adapters/SupabaseParalyzedWorksRepository.js";
import { mapParalyzedRecord, type ParalyzedWork } from "../../src/domain/paralyzedWorks.js";

const MIGRATION = fileURLToPath(
  new URL("../../../../supabase/migrations/20261107000000_official_paralyzed_works.sql", import.meta.url),
);

function work(code: number): ParalyzedWork {
  const mapped = mapParalyzedRecord(
    {
      "CODIGO INFOBRAS": code,
      CUI: 2151761,
      "NIVEL DE GOBIERNO": "G. LOCAL",
      DEPARTAMENTO: "CUSCO",
      "CAUSAL PARALIZACION": "2 INCUMPLIMIENTO DE CONTRATO",
      "UNIDAD ORGÁNICA": "GERENCIA REGIONAL DE CONTROL DE CUSCO",
    },
    { cutoff: "2026-06-30", publishedAt: "2026-08-17" },
  );
  if (!mapped) throw new Error("fixture must have an INFOBRAS code");
  return mapped;
}

/** Columns of `create table public.official_paralyzed_works (...)` in the migration. */
async function tableColumns(): Promise<string[]> {
  const sql = await readFile(MIGRATION, "utf8");
  const body = /create table public\.official_paralyzed_works \(([\s\S]*?)\n\);/.exec(sql)?.[1];
  if (!body) throw new Error("table not found in the migration");
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("--") && !line.startsWith("primary key"))
    .map((line) => line.split(/\s+/)[0]!);
}

/** Records every call of the Supabase client slice the adapter uses. */
function fakeClient(snapshot: Record<string, unknown> | null = null) {
  const calls: Array<{ op: string; table: string; args: unknown[] }> = [];
  const client: ParalyzedClient = {
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

describe("toParalyzedRow", () => {
  it("sends exactly the table's columns, except the ingest time the database sets", async () => {
    const columns = (await tableColumns()).filter((column) => column !== "ingested_at");
    expect(Object.keys(toParalyzedRow(work(1))).sort()).toEqual([...columns].sort());
  });

  it("never sends the Contraloría unit", () => {
    expect(JSON.stringify(toParalyzedRow(work(1)))).not.toContain("GERENCIA REGIONAL");
  });
});

describe("SupabaseParalyzedWorksRepository", () => {
  it("upserts obras on the edition and INFOBRAS code", async () => {
    const { client, calls } = fakeClient();
    const written = await new SupabaseParalyzedWorksRepository(client).upsertParalyzedWorks([work(1), work(2)]);

    expect(written).toBe(2);
    expect(calls).toEqual([
      {
        op: "upsert",
        table: "official_paralyzed_works",
        args: [[toParalyzedRow(work(1)), toParalyzedRow(work(2))], { onConflict: "edition_cutoff,infobras_code" }],
      },
    ]);
  });

  it("reads and records the edition snapshot", async () => {
    const { client, calls } = fakeClient({
      source: "contraloria_obras_paralizadas",
      edition_cutoff: "2026-06-30",
      edition_url: "https://cdn.www.gob.pe/x.XLSX",
      ingested_at: "2026-11-02T11:00:00+00:00",
      checked_at: "2026-11-02T11:01:00+00:00",
      rows_upserted: 2262,
    });
    const repository = new SupabaseParalyzedWorksRepository(client);

    expect(await repository.getEditionSnapshot("contraloria_obras_paralizadas")).toEqual({
      source: "contraloria_obras_paralizadas",
      editionCutoff: "2026-06-30",
      editionUrl: "https://cdn.www.gob.pe/x.XLSX",
      ingestedAt: "2026-11-02T11:00:00+00:00",
      checkedAt: "2026-11-02T11:01:00+00:00",
      rowsUpserted: 2262,
    });

    await repository.recordEditionSnapshot({
      source: "contraloria_obras_paralizadas",
      editionCutoff: "2026-06-30",
      editionUrl: "https://cdn.www.gob.pe/x.XLSX",
      ingestedAt: "2026-11-02T11:00:00.000Z",
      checkedAt: "2026-11-02T11:01:00.000Z",
      rowsUpserted: 2262,
    });
    await repository.markChecked("contraloria_obras_paralizadas", "2026-11-09T11:00:00.000Z");

    expect(calls.slice(1)).toEqual([
      {
        op: "upsert",
        table: "source_snapshots",
        args: [
          [
            {
              source: "contraloria_obras_paralizadas",
              edition_cutoff: "2026-06-30",
              edition_url: "https://cdn.www.gob.pe/x.XLSX",
              last_modified: null,
              content_length: null,
              ingested_at: "2026-11-02T11:00:00.000Z",
              checked_at: "2026-11-02T11:01:00.000Z",
              rows_upserted: 2262,
            },
          ],
          { onConflict: "source" },
        ],
      },
      {
        op: "update",
        table: "source_snapshots",
        args: [{ checked_at: "2026-11-09T11:00:00.000Z" }, "source", "contraloria_obras_paralizadas"],
      },
    ]);
  });

  it("is null without a snapshot", async () => {
    const { client } = fakeClient(null);
    expect(await new SupabaseParalyzedWorksRepository(client).getEditionSnapshot("x")).toBeNull();
  });
});

describe("DryRunParalyzedWorksRepository", () => {
  it("writes the rows it would send as NDJSON and never finds a snapshot", async () => {
    const out = join(await mkdtemp(join(tmpdir(), "paralyzed-")), "rows.ndjson");
    const repository = new DryRunParalyzedWorksRepository(out);

    expect(await repository.getEditionSnapshot("contraloria_obras_paralizadas")).toBeNull();
    await repository.upsertParalyzedWorks([work(1)]);
    await repository.upsertParalyzedWorks([work(2)]);

    const lines = (await readFile(out, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    expect(lines.map((line) => line.infobras_code)).toEqual([1, 2]);
  });
});
