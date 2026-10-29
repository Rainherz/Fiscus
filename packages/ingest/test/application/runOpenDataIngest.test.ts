import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseOpenDataCsv } from "../../src/adapters/OpenDataCsvSource.js";
import { OPEN_DATA_SOURCE, runOpenDataIngest } from "../../src/application/runOpenDataIngest.js";
import type { OpenDataCsvRecord } from "../../src/domain/openData.js";
import type { OpenDataFileInfo } from "../../src/ports/OpenDataSource.js";
import { FakeOpenDataSource, InMemoryOpenDataRepository } from "./openDataFakes.js";

const FILE: OpenDataFileInfo = { lastModified: "2026-10-25T18:31:25.000Z", contentLength: 247423895 };
const NOW = new Date("2026-10-26T10:00:00.000Z");
const silent = () => {};

function row(cui: string, overrides: OpenDataCsvRecord = {}): OpenDataCsvRecord {
  return { CODIGO_UNICO: cui, NIVEL: "GL", UBIGEO: "080101", MONTO_VIABLE: "1000", ...overrides };
}

function setup(rows: readonly OpenDataCsvRecord[], file = FILE) {
  return { source: new FakeOpenDataSource(file, rows), repository: new InMemoryOpenDataRepository() };
}

describe("runOpenDataIngest", () => {
  it("maps, upserts and records the snapshot", async () => {
    const { source, repository } = setup([row("1"), row("2", { NIVEL: "GN", UBIGEO: "" })]);

    const summary = await runOpenDataIngest({ source, repository, now: () => NOW, log: silent });

    expect(summary).toMatchObject({ skipped: false, rowsRead: 2, rowsUpserted: 2, snapshotRecorded: true });
    expect(repository.investments.get("1")).toMatchObject({
      governmentLevel: "GL",
      departmentCode: 8,
      sourceUpdatedAt: FILE.lastModified,
      openDataUpdatedAt: NOW.toISOString(),
    });
    expect(repository.snapshots.get(OPEN_DATA_SOURCE)).toEqual({
      source: OPEN_DATA_SOURCE,
      lastModified: FILE.lastModified,
      contentLength: FILE.contentLength,
      ingestedAt: NOW.toISOString(),
      checkedAt: NOW.toISOString(),
      rowsUpserted: 2,
    });
  });

  it("records the end of the run as the check time", async () => {
    const { source, repository } = setup([row("1")]);
    const times = [new Date("2026-10-26T10:00:00.000Z"), new Date("2026-10-26T10:07:00.000Z")];

    const summary = await runOpenDataIngest({ source, repository, now: () => times.shift() ?? NOW, log: silent });

    expect(repository.snapshots.get(OPEN_DATA_SOURCE)).toMatchObject({
      ingestedAt: "2026-10-26T10:00:00.000Z",
      checkedAt: "2026-10-26T10:07:00.000Z",
    });
    expect(summary.checkedAt).toBe("2026-10-26T10:07:00.000Z");
  });

  describe("unchanged rows", () => {
    it("counts the rows the database actually wrote", async () => {
      const { source, repository } = setup([row("1"), row("2")]);

      const first = await runOpenDataIngest({ source, repository, now: () => NOW, log: silent });

      expect(first).toMatchObject({ rowsUpserted: 2, rowsChanged: 2 });
    });

    it("writes nothing on a forced re-run of the same file", async () => {
      const { source, repository } = setup([row("1"), row("2", { MONTO_VIABLE: "5" })]);
      await runOpenDataIngest({ source, repository, now: () => NOW, log: silent });
      const later = new Date("2026-10-27T10:00:00.000Z");

      const second = await runOpenDataIngest({ source, repository, force: true, now: () => later, log: silent });

      expect(second).toMatchObject({ rowsUpserted: 2, rowsChanged: 0 });
      expect(repository.investments.get("1")?.openDataUpdatedAt).toBe(NOW.toISOString());
    });

    it("writes only the rows whose data changed", async () => {
      const first = setup([row("1"), row("2")]);
      await runOpenDataIngest({ ...first, now: () => NOW, log: silent });
      const later = new Date("2026-10-27T10:00:00.000Z");
      const source = new FakeOpenDataSource(FILE, [row("1"), row("2", { MONTO_VIABLE: "9" })]);

      const second = await runOpenDataIngest({
        source,
        repository: first.repository,
        force: true,
        now: () => later,
        log: silent,
      });

      expect(second.rowsChanged).toBe(1);
      expect(first.repository.investments.get("2")?.openDataUpdatedAt).toBe(later.toISOString());
    });
  });

  describe("snapshot check", () => {
    it("skips without downloading when Last-Modified and Content-Length are unchanged", async () => {
      const { source, repository } = setup([row("1")]);
      await repository.recordSnapshot({
        source: OPEN_DATA_SOURCE,
        lastModified: "2026-10-25T18:31:25+00:00",
        contentLength: FILE.contentLength,
        ingestedAt: "2026-10-25T20:00:00Z",
        checkedAt: "2026-10-25T20:00:00Z",
        rowsUpserted: 9,
      });

      const summary = await runOpenDataIngest({ source, repository, now: () => NOW, log: silent });

      expect(summary.skipped).toBe(true);
      expect(source.recordsCalls).toBe(0);
      expect(repository.upsertBatchSizes).toEqual([]);
      expect(repository.snapshots.get(OPEN_DATA_SOURCE)?.rowsUpserted).toBe(9);
    });

    it("marks the unchanged file as checked, keeping the last ingest time", async () => {
      const { source, repository } = setup([row("1")]);
      await repository.recordSnapshot({
        source: OPEN_DATA_SOURCE,
        ...FILE,
        ingestedAt: "2026-10-25T20:00:00.000Z",
        checkedAt: "2026-10-25T20:00:00.000Z",
        rowsUpserted: 9,
      });

      const summary = await runOpenDataIngest({ source, repository, now: () => NOW, log: silent });

      expect(summary).toMatchObject({ skipped: true, checkedAt: NOW.toISOString() });
      expect(repository.checks).toEqual([{ source: OPEN_DATA_SOURCE, checkedAt: NOW.toISOString() }]);
      expect(repository.snapshots.get(OPEN_DATA_SOURCE)).toMatchObject({
        ingestedAt: "2026-10-25T20:00:00.000Z",
        checkedAt: NOW.toISOString(),
      });
    });

    it("ingests when forced even if unchanged", async () => {
      const { source, repository } = setup([row("1")]);
      await repository.recordSnapshot({ source: OPEN_DATA_SOURCE, ...FILE, ingestedAt: "x", checkedAt: "x", rowsUpserted: 9 });

      const summary = await runOpenDataIngest({ source, repository, force: true, now: () => NOW, log: silent });

      expect(summary.skipped).toBe(false);
      expect(summary.rowsUpserted).toBe(1);
    });

    it("ingests when Last-Modified changed", async () => {
      const { source, repository } = setup([row("1")]);
      await repository.recordSnapshot({
        source: OPEN_DATA_SOURCE,
        lastModified: "2026-10-20T00:00:00.000Z",
        contentLength: FILE.contentLength,
        ingestedAt: "x",
        checkedAt: "x",
        rowsUpserted: 9,
      });

      expect((await runOpenDataIngest({ source, repository, now: () => NOW, log: silent })).skipped).toBe(false);
    });

    it("ingests when Content-Length changed", async () => {
      const { source, repository } = setup([row("1")]);
      await repository.recordSnapshot({ source: OPEN_DATA_SOURCE, ...FILE, contentLength: 1, ingestedAt: "x", checkedAt: "x", rowsUpserted: 9 });

      expect((await runOpenDataIngest({ source, repository, now: () => NOW, log: silent })).skipped).toBe(false);
    });

    it("never skips when the server sends no Last-Modified", async () => {
      const file: OpenDataFileInfo = { lastModified: null, contentLength: FILE.contentLength };
      const { source, repository } = setup([row("1")], file);
      await repository.recordSnapshot({ source: OPEN_DATA_SOURCE, ...file, ingestedAt: "x", checkedAt: "x", rowsUpserted: 9 });

      expect((await runOpenDataIngest({ source, repository, now: () => NOW, log: silent })).skipped).toBe(false);
    });
  });

  describe("chunks and duplicates", () => {
    it("upserts in chunks of the given size", async () => {
      const rows = Array.from({ length: 7 }, (_, i) => row(String(i + 1)));
      const { source, repository } = setup(rows);

      const summary = await runOpenDataIngest({ source, repository, chunkSize: 3, now: () => NOW, log: silent });

      expect(repository.upsertBatchSizes).toEqual([3, 3, 1]);
      expect(summary.rowsUpserted).toBe(7);
    });

    it("defaults to chunks of 1000", async () => {
      const rows = Array.from({ length: 2500 }, (_, i) => row(String(i + 1)));
      const { source, repository } = setup(rows);

      await runOpenDataIngest({ source, repository, now: () => NOW, log: silent });

      expect(repository.upsertBatchSizes).toEqual([1000, 1000, 500]);
    });

    it("keeps the last row of a repeated CUI within a chunk and counts the duplicate", async () => {
      const { source, repository } = setup([row("1", { MONTO_VIABLE: "1" }), row("2"), row("1", { MONTO_VIABLE: "2" })]);

      const summary = await runOpenDataIngest({ source, repository, now: () => NOW, log: silent });

      expect(summary.duplicates).toBe(1);
      expect(summary.rowsUpserted).toBe(2);
      expect(repository.upsertBatchSizes).toEqual([2]);
      expect(repository.investments.get("1")?.viableAmount).toBe(2);
    });

    it("keeps the last row of a repeated CUI across chunks", async () => {
      const { source, repository } = setup([row("1", { MONTO_VIABLE: "1" }), row("2"), row("1", { MONTO_VIABLE: "2" })]);

      const summary = await runOpenDataIngest({ source, repository, chunkSize: 2, now: () => NOW, log: silent });

      expect(summary.duplicates).toBe(1);
      expect(summary.rowsUpserted).toBe(2);
      expect(repository.investments.get("1")?.viableAmount).toBe(2);
    });

    it("skips and counts rows without CUI", async () => {
      const { source, repository } = setup([row(""), row("1"), row("  ")]);

      const summary = await runOpenDataIngest({ source, repository, now: () => NOW, log: silent });

      expect(summary).toMatchObject({ rowsRead: 3, rowsWithoutCui: 2, rowsUpserted: 1 });
    });
  });

  describe("limit", () => {
    it("stops reading after N rows and does not record the snapshot", async () => {
      const rows = Array.from({ length: 10 }, (_, i) => row(String(i + 1)));
      const { source, repository } = setup(rows);

      const summary = await runOpenDataIngest({ source, repository, limit: 4, now: () => NOW, log: silent });

      expect(summary).toMatchObject({ rowsRead: 4, rowsUpserted: 4, snapshotRecorded: false });
      expect(source.recordsYielded).toBe(4);
      expect(repository.snapshots.size).toBe(0);
      expect(repository.checks).toEqual([]);
    });
  });

  it("does not record the snapshot when an upsert fails, so the next run retries", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(String(i + 1)));
    const { source, repository } = setup(rows);
    repository.failOnCall = 2;

    await expect(
      runOpenDataIngest({ source, repository, chunkSize: 2, now: () => NOW, log: silent }),
    ).rejects.toThrow("db unavailable");
    expect(repository.snapshots.size).toBe(0);
    expect(repository.checks).toEqual([]);
  });

  it("reports counts by level, coordinates, department and physical progress over distinct CUIs", async () => {
    const records = parseOpenDataCsv(
      createReadStream(fileURLToPath(new URL("../fixtures/open-data-sample.csv", import.meta.url))),
    );
    const all: OpenDataCsvRecord[] = [];
    for await (const record of records) all.push(record);
    const { source, repository } = setup(all);

    const summary = await runOpenDataIngest({ source, repository, now: () => NOW, log: silent });

    expect(summary).toMatchObject({
      rowsRead: 30,
      rowsWithoutCui: 3,
      duplicates: 1,
      rowsUpserted: 26,
      byLevel: { GR: 5, GN: 8, GL: 13 },
      withCoordinates: 12,
      withoutDepartment: 4,
      withPhysicalProgress: 12,
    });
    expect(repository.investments.size).toBe(26);
    expect(repository.investments.get("2094808")?.accruedTotal).toBe(1459731800.72);
    expect(repository.investments.get("2088142")).toMatchObject({ viableAmount: 1338419640, updatedCost: 5147912126.77 });
  });
});
