import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  parseReportTimestamp,
  parseSsiReport,
  unwrapCellValue,
} from "../../src/adapters/ssiReportParser.js";

const fixturePath = new URL("../fixtures/ssi-arequipa-sample.xlsx", import.meta.url);

async function workbookBuffer(rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inversiones");
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("unwrapCellValue", () => {
  it("unwraps hyperlink cells to their text", () => {
    expect(unwrapCellValue({ text: 143835, hyperlink: "https://example" })).toBe(143835);
  });

  it("unwraps rich text, formula results and shared formulas", () => {
    expect(unwrapCellValue({ richText: [{ text: "GOBIERNO " }, { text: "REGIONAL" }] })).toBe(
      "GOBIERNO REGIONAL",
    );
    expect(unwrapCellValue({ formula: "A1+1", result: 42 })).toBe(42);
    expect(unwrapCellValue({ sharedFormula: "A1", result: "x" })).toBe("x");
  });

  it("maps empty strings to null and passes primitives through", () => {
    expect(unwrapCellValue("")).toBeNull();
    expect(unwrapCellValue(undefined)).toBeNull();
    expect(unwrapCellValue("ACTIVO")).toBe("ACTIVO");
    expect(unwrapCellValue(0)).toBe(0);
  });

  it("maps error cells to null", () => {
    expect(unwrapCellValue({ error: "#N/A" })).toBeNull();
  });
});

describe("parseReportTimestamp", () => {
  it("parses the MEF 12-hour Spanish timestamp as Lima time", () => {
    expect(parseReportTimestamp("Fecha: 26/10/2026 06:41:38 p. m.")).toBe(
      "2026-10-26T18:41:38-05:00",
    );
    expect(parseReportTimestamp("Fecha: 01/02/2026 12:05:00 a. m.")).toBe(
      "2026-02-01T00:05:00-05:00",
    );
    expect(parseReportTimestamp("Fecha: 01/02/2026 12:05:00 p. m.")).toBe(
      "2026-02-01T12:05:00-05:00",
    );
  });

  it("parses 24-hour timestamps without a meridiem", () => {
    expect(parseReportTimestamp("Fecha: 26/10/2026 18:41:38")).toBe("2026-10-26T18:41:38-05:00");
  });

  it("returns null for unrelated text", () => {
    expect(parseReportTimestamp("Reporte de SSI")).toBeNull();
    expect(parseReportTimestamp(null)).toBeNull();
  });
});

describe("parseSsiReport", () => {
  it("detects the header row and extracts records from the real fixture", async () => {
    const report = await parseSsiReport(await readFile(fixturePath));

    expect(report.sourceUpdatedAt).toBe("2026-10-26T18:41:38-05:00");
    expect(report.pimYear).toBe(2023);
    expect(report.records).toHaveLength(5);
    expect(report.unknownHeaders).toEqual([]);
    // Hyperlink cell unwrapped; MEF emits the text as a number, the re-written fixture as a string.
    expect(String(report.records[0]?.snipCode)).toBe("143835");
    expect(report.records[0]).toMatchObject({
      cui: "2114611",
      governmentLevel: "GR",
      registeredAt: "28/01/2010",
      viableAmount: 1372738,
      pim: 35500,
      accruedYear: 410,
      firstAccrualMonth: "2010-08",
      updatedCost: 1420793,
      concurrentControlCost: 0,
    });
  });

  it("keeps rows with an empty CUI as null so the caller can count them", async () => {
    const report = await parseSsiReport(await readFile(fixturePath));
    expect(report.records.filter((r) => r.cui === null)).toHaveLength(1);
  });

  it("maps empty-string cells to null", async () => {
    const report = await parseSsiReport(await readFile(fixturePath));
    const withoutAccrual = report.records.filter((r) => r.cui !== null && r.firstAccrualMonth === null);
    expect(withoutAccrual.length).toBeGreaterThan(0);
  });

  it("matches PIM/DEVENGADO columns by prefix and records the header year", async () => {
    const buffer = await workbookBuffer([
      ["Reporte de SSI"],
      ["CUI", "PIM 2026", "DEVENGADO 2026", "DEVENGADO ACUMULADO", "COLUMNA NUEVA"],
      ["123", 10, 5, 7, "x"],
    ]);

    const report = await parseSsiReport(buffer);

    expect(report.pimYear).toBe(2026);
    expect(report.sourceUpdatedAt).toBeNull();
    expect(report.unknownHeaders).toEqual(["COLUMNA NUEVA"]);
    expect(report.records).toEqual([{ cui: "123", pim: 10, accruedYear: 5, accruedTotal: 7 }]);
  });

  it("skips fully empty rows after the header", async () => {
    const buffer = await workbookBuffer([["CUI", "NOMBRE DE LA INVERSION"], ["1", "A"], [], ["2", "B"]]);
    const report = await parseSsiReport(buffer);
    expect(report.records.map((r) => r.cui)).toEqual(["1", "2"]);
  });

  it("throws when no header row starting with CUI exists", async () => {
    const buffer = await workbookBuffer([["Reporte de SSI"], ["nothing here"]]);
    await expect(parseSsiReport(buffer)).rejects.toThrow(/header row/i);
  });
});
