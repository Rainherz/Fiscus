import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { closedDataSource } from "../../src/adapters/OpenDataCsvSource.js";
import { CLOSED_DATA_SOURCE, runClosedDataIngest } from "../../src/application/runClosedDataIngest.js";
import { OPEN_DATA_SOURCE } from "../../src/application/runOpenDataIngest.js";
import type { OpenDataCsvRecord } from "../../src/domain/openData.js";
import type { OpenDataFileInfo } from "../../src/ports/OpenDataSource.js";
import { FakeOpenDataSource, InMemoryOpenDataRepository } from "./openDataFakes.js";

const FILE: OpenDataFileInfo = { lastModified: "2026-10-27T18:12:19.000Z", contentLength: 119799403 };
const NOW = new Date("2026-10-28T10:05:00.000Z");
const silent = () => {};
const CLOSED_FIXTURE = fileURLToPath(new URL("../fixtures/closed-data-sample.csv", import.meta.url));

function row(cui: string, overrides: OpenDataCsvRecord = {}): OpenDataCsvRecord {
  return {
    CODIGO_UNICO: cui,
    NIVEL: "GL",
    ESTADO: "CERRADO",
    UBIGEO: "080101",
    MONTO_VIABLE: "1000",
    FEC_CIERRE: "2024-05-02 10:00:00",
    ...overrides,
  };
}

function setup(rows: readonly OpenDataCsvRecord[], file = FILE) {
  return { source: new FakeOpenDataSource(file, rows), repository: new InMemoryOpenDataRepository() };
}

describe("runClosedDataIngest", () => {
  it("uses its own snapshot key", () => {
    expect(CLOSED_DATA_SOURCE).toBe("mef_cierre_inversiones");
    expect(CLOSED_DATA_SOURCE).not.toBe(OPEN_DATA_SOURCE);
  });

  it("maps, upserts through the closed upsert and records its own snapshot", async () => {
    const { source, repository } = setup([row("1"), row("2", { NIVEL: "GN", UBIGEO: "" })]);

    const summary = await runClosedDataIngest({ source, repository, now: () => NOW, log: silent });

    expect(summary).toMatchObject({ skipped: false, rowsRead: 2, rowsUpserted: 2, rowsChanged: 2, snapshotRecorded: true });
    expect(repository.closedInvestments.get("1")).toMatchObject({
      status: "CERRADO",
      closedAt: "2024-05-02",
      departmentCode: 8,
      sourceUpdatedAt: FILE.lastModified,
      openDataUpdatedAt: NOW.toISOString(),
    });
    expect(repository.investments.size).toBe(0);
    expect(repository.snapshots.get(CLOSED_DATA_SOURCE)).toEqual({
      source: CLOSED_DATA_SOURCE,
      lastModified: FILE.lastModified,
      contentLength: FILE.contentLength,
      ingestedAt: NOW.toISOString(),
      checkedAt: NOW.toISOString(),
      rowsUpserted: 2,
    });
    expect(repository.snapshots.has(OPEN_DATA_SOURCE)).toBe(false);
  });

  it("skips rows without CUI and keeps the last row of a repeated CUI", async () => {
    const { source, repository } = setup([
      row("1", { COSTO_ACTUALIZADO: "100" }),
      row(""),
      row("1", { COSTO_ACTUALIZADO: "200" }),
    ]);

    const summary = await runClosedDataIngest({ source, repository, now: () => NOW, log: silent });

    expect(summary).toMatchObject({ rowsRead: 3, rowsWithoutCui: 1, duplicates: 1, rowsUpserted: 1 });
    expect(repository.closedInvestments.get("1")?.updatedCost).toBe(200);
  });

  it("counts closure facts over distinct CUIs", async () => {
    const { source, repository } = setup([
      row("1", { TOTAL_LIQUIDACION: "500.0", CULMINADA: "SÍ", LATITUD: "-13.5", LONGITUD: "-71.9" }),
      row("2", { TOTAL_LIQUIDACION: "", CULMINADA: "NO", FEC_CIERRE: "" }),
      row("3", { NIVEL: "GN", UBIGEO: "990000" }),
    ]);

    const summary = await runClosedDataIngest({ source, repository, now: () => NOW, log: silent });

    expect(summary).toMatchObject({
      byLevel: { GL: 2, GN: 1 },
      withCoordinates: 1,
      withoutDepartment: 1,
      withClosureDate: 2,
      withLiquidation: 1,
      culminated: 1,
    });
  });

  it("upserts in chunks", async () => {
    const { source, repository } = setup([row("1"), row("2"), row("3")]);

    await runClosedDataIngest({ source, repository, chunkSize: 2, now: () => NOW, log: silent });

    expect(repository.upsertBatchSizes).toEqual([2, 1]);
  });

  it("writes nothing on a forced re-run of the same file", async () => {
    const { source, repository } = setup([row("1"), row("2")]);
    await runClosedDataIngest({ source, repository, now: () => NOW, log: silent });

    const second = await runClosedDataIngest({
      source,
      repository,
      force: true,
      now: () => new Date("2026-10-29T10:05:00.000Z"),
      log: silent,
    });

    expect(second).toMatchObject({ rowsUpserted: 2, rowsChanged: 0 });
  });

  it("skips without downloading when the closed file is unchanged, and marks it checked", async () => {
    const { source, repository } = setup([row("1")]);
    await repository.recordSnapshot({
      source: CLOSED_DATA_SOURCE,
      ...FILE,
      ingestedAt: "2026-10-27T20:00:00.000Z",
      checkedAt: "2026-10-27T20:00:00.000Z",
      rowsUpserted: 9,
    });

    const summary = await runClosedDataIngest({ source, repository, now: () => NOW, log: silent });

    expect(summary).toMatchObject({ skipped: true, checkedAt: NOW.toISOString() });
    expect(source.recordsCalls).toBe(0);
    expect(repository.checks).toEqual([{ source: CLOSED_DATA_SOURCE, checkedAt: NOW.toISOString() }]);
    expect(repository.snapshots.get(CLOSED_DATA_SOURCE)).toMatchObject({
      ingestedAt: "2026-10-27T20:00:00.000Z",
      rowsUpserted: 9,
    });
  });

  it("is not skipped by the active file's snapshot", async () => {
    const { source, repository } = setup([row("1")]);
    await repository.recordSnapshot({
      source: OPEN_DATA_SOURCE,
      ...FILE,
      ingestedAt: "2026-10-27T20:00:00.000Z",
      checkedAt: "2026-10-27T20:00:00.000Z",
      rowsUpserted: 9,
    });

    const summary = await runClosedDataIngest({ source, repository, now: () => NOW, log: silent });

    expect(summary.skipped).toBe(false);
  });

  it("never records the snapshot on a limited run", async () => {
    const { source, repository } = setup([row("1"), row("2"), row("3")]);

    const summary = await runClosedDataIngest({ source, repository, limit: 2, now: () => NOW, log: silent });

    expect(summary).toMatchObject({ rowsRead: 2, snapshotRecorded: false, checkedAt: null });
    expect(repository.snapshots.size).toBe(0);
  });

  it("ingests the committed fixture end to end without any person's name", async () => {
    const repository = new InMemoryOpenDataRepository();

    const summary = await runClosedDataIngest({
      source: closedDataSource({ location: CLOSED_FIXTURE }),
      repository,
      now: () => NOW,
      log: silent,
    });

    expect(summary).toMatchObject({ rowsRead: 29, rowsWithoutCui: 2, duplicates: 1, rowsUpserted: 26 });
    expect(summary.byLevel).toEqual({ GL: 13, GN: 9, GR: 4 });
    expect(JSON.stringify([...repository.closedInvestments.values()])).not.toContain("PERSONA DE PRUEBA");
  });
});
