import { describe, expect, it } from "vitest";
import { runIngest } from "../../src/application/runIngest.js";
import type { SourceReport } from "../../src/ports/InvestmentSource.js";
import { FakeInvestmentSource, InMemoryInvestmentRepository } from "./fakes.js";

const report = (cuis: Array<string | null>): SourceReport => ({
  sourceUpdatedAt: "2026-10-26T18:41:38-05:00",
  pimYear: 2023,
  records: cuis.map((cui, i) => ({ cui, viableAmount: 100, updatedCost: 120 + i, accruedTotal: 60 })),
});

const clock = () => {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 9, 27, 9, 0, tick++));
};
const silent = () => {};

describe("runIngest", () => {
  it("fetches departments sequentially, normalizes and upserts them", async () => {
    const source = new FakeInvestmentSource({ 4: report(["a", "b"]), 15: report(["c"]) });
    const repository = new InMemoryInvestmentRepository();

    const summary = await runIngest({ source, repository, departments: [4, 15], now: clock(), log: silent });

    expect(source.requested).toEqual([4, 15]);
    expect(summary.departmentsOk).toEqual([4, 15]);
    expect(summary.departmentsFailed).toEqual([]);
    expect(summary.rowsUpserted).toBe(3);
    expect(repository.investments.get("c")).toMatchObject({
      departmentCode: 15,
      departmentName: "Lima",
      pimYear: 2023,
      costIncrease: 20,
      executionProgress: 0.5,
    });
  });

  it("skips and counts rows without a CUI", async () => {
    const source = new FakeInvestmentSource({ 4: report(["a", null, "", "b"]) });
    const repository = new InMemoryInvestmentRepository();

    const summary = await runIngest({ source, repository, departments: [4], now: clock(), log: silent });

    expect(summary.rowsUpserted).toBe(2);
    expect(summary.rowsSkipped).toBe(2);
    expect(summary.results[0]).toMatchObject({ departmentCode: 4, ok: true, rows: 2, skipped: 2 });
  });

  it("keeps the last occurrence when a CUI repeats within a department", async () => {
    const source = new FakeInvestmentSource({ 4: report(["a", "a"]) });
    const repository = new InMemoryInvestmentRepository();

    const summary = await runIngest({ source, repository, departments: [4], now: clock(), log: silent });

    expect(summary.rowsUpserted).toBe(1);
    expect(summary.duplicatesDropped).toBe(1);
    expect(repository.investments.get("a")?.updatedCost).toBe(121);
  });

  it("continues after a department fails and records the run", async () => {
    const source = new FakeInvestmentSource({
      1: new Error("timeout"),
      4: report(["a"]),
      15: report(["c"]),
    });
    const repository = new InMemoryInvestmentRepository();
    repository.failOnDepartment = 15;

    const summary = await runIngest({ source, repository, departments: [1, 4, 15], now: clock(), log: silent });

    expect(summary.departmentsOk).toEqual([4]);
    expect(summary.departmentsFailed).toEqual([1, 15]);
    expect(summary.results.find((r) => r.departmentCode === 1)).toMatchObject({ ok: false, error: "timeout" });
    expect(summary.allFailed).toBe(false);
    expect(repository.runs).toEqual([
      {
        startedAt: "2026-10-27T09:00:00.000Z",
        finishedAt: "2026-10-27T09:00:01.000Z",
        departmentsOk: [4],
        departmentsFailed: [1, 15],
        rowsUpserted: 1,
        rowsSkipped: 0,
      },
    ]);
  });

  it("flags allFailed when every department fails", async () => {
    const source = new FakeInvestmentSource({ 1: new Error("x"), 2: new Error("y") });
    const repository = new InMemoryInvestmentRepository();

    const summary = await runIngest({ source, repository, departments: [1, 2], now: clock(), log: silent });

    expect(summary.allFailed).toBe(true);
    expect(repository.upsertCalls).toBe(0);
  });

  it("still returns the summary if recording the run fails", async () => {
    const source = new FakeInvestmentSource({ 4: report(["a"]) });
    const repository = new InMemoryInvestmentRepository();
    repository.recordRun = async () => {
      throw new Error("insert failed");
    };
    const logs: string[] = [];

    const summary = await runIngest({
      source,
      repository,
      departments: [4],
      now: clock(),
      log: (message) => logs.push(message),
    });

    expect(summary.departmentsOk).toEqual([4]);
    expect(logs.some((l) => l.includes("insert failed"))).toBe(true);
  });
});
