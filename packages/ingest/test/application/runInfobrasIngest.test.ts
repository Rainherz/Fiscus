import { describe, expect, it } from "vitest";
import { INFOBRAS_SOURCE, runInfobrasIngest } from "../../src/application/runInfobrasIngest.js";
import type { InfobrasRecord } from "../../src/domain/infobrasWorks.js";
import { FakeInfobrasSource, InMemoryInfobrasRepository, OCT_30, OCT_31 } from "./infobrasFakes.js";

function record(code: string, overrides: Record<string, string> = {}): InfobrasRecord {
  return {
    "Código INFOBRAS": code,
    "Estado de ejecución": "En Ejecución",
    "Codigo unico de inversión": "2132947",
    "RUC (Ejecución)": "20301552115",
    "Nombre o razón social de la empresa o consorcio": "AMERIKA PROMASER S R L",
    "RUC (Supervisión)": "",
    "Nombre o razón social de la empresa o consorcio #2": "",
    "Fecha de registro de avance": "31/01/2026",
    ...overrides,
  };
}

const ROWS: InfobrasRecord[] = [
  record("1"),
  record("2", { "Estado de ejecución": "Finalizado", "Fecha de registro de avance": "31/03/2026" }),
  record("3", { "RUC (Ejecución)": "10412345678", "Nombre o razón social de la empresa o consorcio": "JUAN PEREZ" }),
  record("4", { "RUC (Ejecución)": "C0003136723", "Nombre o razón social de la empresa o consorcio": "CONSORCIO VIAL", "Codigo unico de inversión": "0" }),
  record(""),
  record("2", { "Estado de ejecución": "Paralizada", "Fecha de registro de avance": "31/03/2026" }),
  record("5", { "Estado de ejecución": "Sin Ejecución", "Fecha de registro de avance": "", "RUC (Supervisión)": "20341472564", "Nombre o razón social de la empresa o consorcio #2": "SUPERVISA SAC" }),
];

const clock = (...isoTimes: string[]) => {
  let i = 0;
  return () => new Date(isoTimes[Math.min(i++, isoTimes.length - 1)]!);
};

describe("runInfobrasIngest", () => {
  it("upserts every obra in chunks, counts kinds and records the snapshot with data_as_of", async () => {
    const source = new FakeInfobrasSource(OCT_30, ROWS);
    const repository = new InMemoryInfobrasRepository();

    const summary = await runInfobrasIngest({
      source,
      repository,
      chunkSize: 2,
      now: clock("2026-10-31T11:00:00.000Z", "2026-10-31T11:05:00.000Z"),
      log: () => {},
    });

    expect(summary).toMatchObject({
      skipped: false,
      rowsRead: 7,
      rowsWithoutCode: 1,
      duplicates: 1,
      obras: 5,
      rowsWritten: 5,
      removed: 0,
      withCui: 4,
      byStatus: { "En Ejecución": 3, Finalizado: 1, "Sin Ejecución": 1 },
      contractorKinds: { empresa: 3, persona_natural: 1, consorcio: 1 },
      supervisorKinds: { none: 4, empresa: 1 },
      dataAsOf: "2026-03-31",
      bytes: 57_378_068,
    });
    expect(repository.works.size).toBe(5);
    // The first row of a repeated code wins (the file is streamed; repeats are not expected).
    expect(repository.works.get(2)?.executionStatus).toBe("Finalizado");
    expect(repository.works.get(3)).toMatchObject({ contractorKind: "persona_natural", contractorRuc: null, contractorName: null });
    expect(Math.max(...repository.batchSizes)).toBeLessThanOrEqual(2);
    expect(repository.snapshots.get(INFOBRAS_SOURCE)).toEqual({
      source: INFOBRAS_SOURCE,
      fileUrl: OCT_30.url,
      contentLength: 57_378_068,
      dataAsOf: "2026-03-31",
      ingestedAt: "2026-10-31T11:00:00.000Z",
      checkedAt: "2026-10-31T11:05:00.000Z",
      rowsUpserted: 5,
    });
    expect(source.cleanups).toBe(1);
    expect(repository.refreshes).toBe(1);
  });

  it("skips the same file name without downloading and only moves the check time", async () => {
    const repository = new InMemoryInfobrasRepository();
    await runInfobrasIngest({ source: new FakeInfobrasSource(OCT_30, ROWS), repository, log: () => {} });
    const again = new FakeInfobrasSource(OCT_30, ROWS);

    const summary = await runInfobrasIngest({
      source: again,
      repository,
      now: clock("2026-11-03T11:00:00.000Z"),
      log: () => {},
    });

    expect(summary).toMatchObject({ skipped: true, skipReason: "same-file", checkedAt: "2026-11-03T11:00:00.000Z" });
    expect(again.downloads + again.skippedDownloads).toBe(0);
    expect(repository.snapshots.get(INFOBRAS_SOURCE)?.checkedAt).toBe("2026-11-03T11:00:00.000Z");
    // The contractor totals take their scope from investments, which change daily: refreshed anyway.
    expect(repository.refreshes).toBe(2);
  });

  it("skips a new file name with the same size (the daily file is regenerated with the same content)", async () => {
    const repository = new InMemoryInfobrasRepository();
    await runInfobrasIngest({ source: new FakeInfobrasSource(OCT_30, ROWS), repository, log: () => {} });
    const next = new FakeInfobrasSource(OCT_31, ROWS);

    const summary = await runInfobrasIngest({ source: next, repository, log: () => {} });

    expect(summary).toMatchObject({ skipped: true, skipReason: "same-size" });
    expect(next.skippedDownloads).toBe(1);
    expect(next.downloads).toBe(0);
  });

  it("ingests the same file again with force; unchanged obras are not rewritten", async () => {
    const repository = new InMemoryInfobrasRepository();
    await runInfobrasIngest({ source: new FakeInfobrasSource(OCT_30, ROWS), repository, log: () => {} });
    const forced = new FakeInfobrasSource(OCT_30, ROWS);

    const summary = await runInfobrasIngest({ source: forced, repository, force: true, log: () => {} });

    expect(summary).toMatchObject({ skipped: false, obras: 5, rowsWritten: 0 });
    expect(forced.downloads).toBe(1);
  });

  it("marks obras missing from a new file as removed", async () => {
    const repository = new InMemoryInfobrasRepository();
    await runInfobrasIngest({ source: new FakeInfobrasSource(OCT_30, ROWS), repository, log: () => {} });

    const summary = await runInfobrasIngest({
      source: new FakeInfobrasSource(OCT_31, ROWS.filter((r) => r["Código INFOBRAS"] !== "5"), 1),
      repository,
      log: () => {},
    });

    expect(summary).toMatchObject({ obras: 4, removed: 1 });
    expect([...repository.removed]).toEqual([5]);
  });

  it("fails without any obra and deletes the temporary file", async () => {
    const source = new FakeInfobrasSource(OCT_30, [record("")]);
    await expect(
      runInfobrasIngest({ source, repository: new InMemoryInfobrasRepository(), log: () => {} }),
    ).rejects.toThrow(/no obra with an INFOBRAS code/);
    expect(source.cleanups).toBe(1);
  });

  it("does not refresh or record anything when the load fails", async () => {
    const repository = new InMemoryInfobrasRepository();
    await expect(
      runInfobrasIngest({ source: new FakeInfobrasSource(OCT_30, [record("")]), repository, log: () => {} }),
    ).rejects.toThrow();
    expect(repository.refreshes).toBe(0);
    expect(repository.snapshots.size).toBe(0);
  });
});
