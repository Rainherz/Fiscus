import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseParalyzedXlsx } from "../../src/adapters/GobPeParalyzedWorksSource.js";
import { PARALYZED_SOURCE, runParalyzedWorksIngest } from "../../src/application/runParalyzedWorksIngest.js";
import type { ParalyzedRecord } from "../../src/domain/paralyzedWorks.js";
import { FakeParalyzedWorksSource, InMemoryParalyzedWorksRepository, JUNE_2026 } from "./paralyzedFakes.js";

const NOW = new Date("2026-11-02T11:00:00.000Z");
const silent = () => {};

function record(code: number, cui: number, overrides: ParalyzedRecord = {}): ParalyzedRecord {
  return {
    "CODIGO INFOBRAS": code,
    CUI: cui,
    "NIVEL DE GOBIERNO": "G. LOCAL",
    DEPARTAMENTO: "CUSCO",
    "CAUSAL PARALIZACION": "2 INCUMPLIMIENTO DE CONTRATO",
    "SALDO DE OBRA": 1000,
    "ESTA EN EL INVENTARIO OBRAS PARALIZADAS MEF": "NO",
    ...overrides,
  };
}

function setup(rows: readonly ParalyzedRecord[]) {
  return { source: new FakeParalyzedWorksSource(JUNE_2026, rows), repository: new InMemoryParalyzedWorksRepository() };
}

describe("runParalyzedWorksIngest", () => {
  it("maps the edition, upserts every obra and records the edition snapshot", async () => {
    const { source, repository } = setup([
      record(1, 2151761),
      record(2, 2151761, { "NIVEL DE GOBIERNO": "G. NACIONAL", "ESTA EN EL INVENTARIO OBRAS PARALIZADAS MEF": "SI" }),
      record(3, 0),
    ]);

    const summary = await runParalyzedWorksIngest({ source, repository, now: () => NOW, log: silent });

    expect(summary).toMatchObject({
      skipped: false,
      edition: { cutoff: "2026-06-30", publishedAt: "2026-08-17", xlsxUrl: JUNE_2026.xlsxUrl },
      rowsRead: 3,
      rowsWithoutCode: 0,
      duplicates: 0,
      rowsUpserted: 3,
      distinctCuis: 1,
      withoutCui: 1,
      byLevel: { GL: 2, GN: 1 },
      mefInventory: 1,
      withoutDepartment: 0,
      snapshotRecorded: true,
      checkedAt: NOW.toISOString(),
    });
    expect(repository.works.get("2026-06-30:2")).toMatchObject({ cui: "2151761", governmentLevel: "GN", mefInventory: true });
    expect(repository.works.get("2026-06-30:3")?.cui).toBeNull();
    expect(repository.snapshots.get(PARALYZED_SOURCE)).toEqual({
      source: PARALYZED_SOURCE,
      editionCutoff: "2026-06-30",
      editionUrl: JUNE_2026.xlsxUrl,
      ingestedAt: NOW.toISOString(),
      checkedAt: NOW.toISOString(),
      rowsUpserted: 3,
    });
  });

  it("skips an edition whose file was already ingested and only moves the check time", async () => {
    const { source, repository } = setup([record(1, 2151761)]);
    repository.snapshots.set(PARALYZED_SOURCE, {
      source: PARALYZED_SOURCE,
      editionCutoff: "2026-06-30",
      editionUrl: JUNE_2026.xlsxUrl,
      ingestedAt: "2026-10-26T11:00:00.000Z",
      checkedAt: "2026-10-26T11:00:00.000Z",
      rowsUpserted: 2262,
    });

    const summary = await runParalyzedWorksIngest({ source, repository, now: () => NOW, log: silent });

    expect(summary).toMatchObject({ skipped: true, rowsRead: 0, snapshotRecorded: false, checkedAt: NOW.toISOString() });
    expect(source.recordsRead).toBe(0);
    expect(repository.works.size).toBe(0);
    expect(repository.checks).toEqual([{ source: PARALYZED_SOURCE, checkedAt: NOW.toISOString() }]);
    expect(repository.snapshots.get(PARALYZED_SOURCE)?.rowsUpserted).toBe(2262);
  });

  it("ingests again with force, or when the file URL changed", async () => {
    const previous = {
      source: PARALYZED_SOURCE,
      editionCutoff: "2026-03-31",
      editionUrl: "https://cdn.www.gob.pe/uploads/document/file/1/anexo-n-01.XLSX?v=0",
      ingestedAt: "2026-06-01T11:00:00.000Z",
      checkedAt: "2026-10-26T11:00:00.000Z",
      rowsUpserted: 2100,
    };
    const changed = setup([record(1, 2151761)]);
    changed.repository.snapshots.set(PARALYZED_SOURCE, previous);
    expect((await runParalyzedWorksIngest({ ...changed, now: () => NOW, log: silent })).skipped).toBe(false);

    const forced = setup([record(1, 2151761)]);
    forced.repository.snapshots.set(PARALYZED_SOURCE, { ...previous, editionUrl: JUNE_2026.xlsxUrl });
    const summary = await runParalyzedWorksIngest({ ...forced, force: true, now: () => NOW, log: silent });
    expect(summary).toMatchObject({ skipped: false, rowsUpserted: 1 });
  });

  it("keeps the last row of a repeated INFOBRAS code and drops rows without one", async () => {
    const { source, repository } = setup([
      record(1, 2151761, { "SALDO DE OBRA": 5 }),
      record(1, 2151761, { "SALDO DE OBRA": 7 }),
      record(0, 2151761),
      { "CODIGO INFOBRAS": null, CUI: 1 },
    ]);

    const summary = await runParalyzedWorksIngest({ source, repository, now: () => NOW, log: silent });

    expect(summary).toMatchObject({ rowsRead: 4, rowsWithoutCode: 2, duplicates: 1, rowsUpserted: 1 });
    expect(repository.works.get("2026-06-30:1")?.remainingWorkBalance).toBe(7);
  });

  it("writes in chunks", async () => {
    const rows = Array.from({ length: 1201 }, (_, i) => record(i + 1, 2000000 + i));
    const { source, repository } = setup(rows);

    await runParalyzedWorksIngest({ source, repository, chunkSize: 500, now: () => NOW, log: silent });

    expect(repository.batchSizes).toEqual([500, 500, 201]);
  });

  it("fails without recording anything when no row can be keyed (the format changed)", async () => {
    const { source, repository } = setup([{ OBRA: "x" }]);

    await expect(runParalyzedWorksIngest({ source, repository, now: () => NOW, log: silent })).rejects.toThrow(
      /no obra with an INFOBRAS code/,
    );
    expect(repository.snapshots.size).toBe(0);
  });

  it("ingests the committed sample of the June 2026 Anexo N° 01", async () => {
    const sample = fileURLToPath(new URL("../fixtures/contraloria-anexo01-sample.xlsx", import.meta.url));
    const { source, repository } = setup(await parseParalyzedXlsx(readFileSync(sample)));

    const summary = await runParalyzedWorksIngest({ source, repository, now: () => NOW, log: silent });

    expect(summary).toMatchObject({
      rowsRead: 19,
      rowsUpserted: 19,
      rowsWithoutCode: 0,
      distinctCuis: 14,
      withoutCui: 2,
      withoutDepartment: 0,
      byLevel: { GN: 9, GR: 4, GL: 6 },
    });
    expect(repository.works.get("2026-06-30:67822")).toMatchObject({
      cui: "2207089",
      causalCode: 11,
      mefInventoryRegisteredAt: "2025-12-13",
    });
    expect(repository.works.get("2026-06-30:56739")).toMatchObject({
      causalCode: null,
      causalLabel: "OTRAS SITUACIONES IMPREVISIBLES POSTERIORES AL PERFECCIONAMIENTO DEL CONTRATO",
    });
    expect(repository.works.get("2026-06-30:38318")?.startYear).toBeNull();
  });
});
