import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonFileInvestmentRepository } from "../../src/adapters/JsonFileInvestmentRepository.js";
import {
  SupabaseInvestmentRepository,
  toInvestmentRow,
  type TableClient,
} from "../../src/adapters/SupabaseInvestmentRepository.js";
import { normalizeInvestment, type Investment } from "../../src/domain/investment.js";

function investment(cui: string): Investment {
  const result = normalizeInvestment(
    {
      cui,
      snipCode: "143835",
      name: "OBRA",
      viableAmount: 100_000,
      updatedCost: 150_000,
      accruedTotal: 75_000,
      registeredAt: "28/01/2010",
      firstAccrualMonth: "2010-08",
    },
    { departmentCode: 4, sourceUpdatedAt: "2026-10-26T18:41:38-05:00", pimYear: 2023 },
  );
  if (!result) throw new Error("fixture investment must have a CUI");
  return result;
}

class FakeTableClient implements TableClient {
  readonly calls: Array<{ table: string; op: string; rows: unknown[]; options?: unknown }> = [];
  failUpsert = false;

  from(table: string) {
    return {
      upsert: async (rows: unknown[], options?: unknown) => {
        this.calls.push({ table, op: "upsert", rows, options });
        return { error: this.failUpsert ? { message: "duplicate key" } : null };
      },
      insert: async (rows: unknown[]) => {
        this.calls.push({ table, op: "insert", rows });
        return { error: null };
      },
    };
  }
}

describe("toInvestmentRow", () => {
  it("maps to snake_case columns and omits database-generated metrics", () => {
    const row = toInvestmentRow(investment("1"));

    expect(row).toMatchObject({
      cui: "1",
      snip_code: "143835",
      viable_amount: 100_000,
      updated_cost: 150_000,
      accrued_total: 75_000,
      registered_at: "2010-01-28",
      first_accrual_month: "2010-08-01",
      pim_year: 2023,
      department_code: 4,
      department_name: "Arequipa",
      source_updated_at: "2026-10-26T18:41:38-05:00",
    });
    expect(row).not.toHaveProperty("cost_increase");
    expect(row).not.toHaveProperty("cost_increase_pct");
    expect(row).not.toHaveProperty("execution_progress");
    expect(row).not.toHaveProperty("updated_cost_valid");
    expect(row).not.toHaveProperty("spent_anomaly");
    expect(row).not.toHaveProperty("ingested_at");
  });
});

describe("SupabaseInvestmentRepository", () => {
  it("upserts in chunks on conflict cui", async () => {
    const client = new FakeTableClient();
    const repository = new SupabaseInvestmentRepository(client, { chunkSize: 2 });

    const written = await repository.upsertInvestments(["1", "2", "3", "4", "5"].map(investment));

    expect(written).toBe(5);
    expect(client.calls.map((c) => c.rows.length)).toEqual([2, 2, 1]);
    expect(client.calls[0]).toMatchObject({ table: "investments", op: "upsert", options: { onConflict: "cui" } });
  });

  it("does nothing for an empty batch", async () => {
    const client = new FakeTableClient();
    await expect(new SupabaseInvestmentRepository(client).upsertInvestments([])).resolves.toBe(0);
    expect(client.calls).toEqual([]);
  });

  it("throws with the database error message", async () => {
    const client = new FakeTableClient();
    client.failUpsert = true;
    await expect(new SupabaseInvestmentRepository(client).upsertInvestments([investment("1")])).rejects.toThrow(
      /duplicate key/,
    );
  });

  it("records runs into ingest_runs", async () => {
    const client = new FakeTableClient();
    await new SupabaseInvestmentRepository(client).recordRun({
      startedAt: "a",
      finishedAt: "b",
      departmentsOk: [4],
      departmentsFailed: [1],
      rowsUpserted: 10,
      rowsSkipped: 2,
    });
    expect(client.calls).toEqual([
      {
        table: "ingest_runs",
        op: "insert",
        rows: [
          {
            started_at: "a",
            finished_at: "b",
            departments_ok: [4],
            departments_failed: [1],
            rows_upserted: 10,
            rows_skipped: 2,
          },
        ],
      },
    ]);
  });
});

describe("JsonFileInvestmentRepository", () => {
  it("writes per-department investments and the run summary as JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fiscus-dry-run-"));
    const repository = new JsonFileInvestmentRepository(dir);

    await repository.upsertInvestments([investment("1"), investment("2")]);
    await repository.recordRun({
      startedAt: "a",
      finishedAt: "b",
      departmentsOk: [4],
      departmentsFailed: [],
      rowsUpserted: 2,
      rowsSkipped: 0,
    });

    const written = JSON.parse(await readFile(join(dir, "investments-04.json"), "utf8"));
    expect(written.map((i: Investment) => i.cui)).toEqual(["1", "2"]);
    expect(written[0].costIncrease).toBe(50_000);
    const run = JSON.parse(await readFile(join(dir, "run.json"), "utf8"));
    expect(run.rowsUpserted).toBe(2);
  });
});
