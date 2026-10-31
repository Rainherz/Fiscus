import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { openZipEntry, readInfobrasRecords, sheetRows } from "../../src/adapters/infobrasXlsx.js";
import { INFOBRAS_HEADERS } from "../../src/domain/infobrasWorks.js";
import { minimalXlsx, sheetXml, zip } from "../support/minimalXlsx.js";

const dir = mkdtempSync(join(tmpdir(), "infobras-xlsx-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function file(name: string, bytes: Uint8Array): string {
  const path = join(dir, name);
  writeFileSync(path, bytes);
  return path;
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

async function text(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** XML split in small chunks, so that elements and text cross chunk boundaries. */
const chunked = (xml: string, size = 7) =>
  Readable.from(Array.from({ length: Math.ceil(xml.length / size) }, (_, i) => Buffer.from(xml.slice(i * size, (i + 1) * size))));

const TITLE = [["Dataset - Obras Públicas"], ["Fuente: Sistema de información de obras públicas - INFOBRAS"], ["Fecha de consulta: 30/10/2026"]];
const HEADER = [
  "Código INFOBRAS",
  "Estado de ejecución",
  "Codigo unico de inversión",
  "RUC (Ejecución)",
  "Nombre o razón social de la empresa o consorcio",
  "Monto del contrato  en soles",
  "RUC (Supervisión)",
  "Nombre o razón social de la empresa o consorcio:",
  "Monto del contrato  en soles",
  "Nombres Apellidos (Supervisión)",
  "Nombres Apellidos (Residente)",
];
const ROW = ["36233", "En Ejecución", "2132947", "20301552115", "A & B S.A.C.", "3158683 99", "10412345678", "JUAN PEREZ", "35000", "MARIA LOPEZ", "ROSA DIAZ"];

describe("openZipEntry", () => {
  it("streams one entry of the archive", async () => {
    const path = file("a.zip", zip({ "a.txt": "first", "dir/b.txt": "second entry" }));
    expect(await text(await openZipEntry(path, "dir/b.txt"))).toBe("second entry");
  });

  it("rejects a missing entry and a file that is not an archive", async () => {
    const path = file("b.zip", zip({ "a.txt": "first" }));
    await expect(openZipEntry(path, "nope.xml")).rejects.toThrow(/nope\.xml not found/);
    const html = file("c.zip", Buffer.from("<html>Mantenimiento</html>"));
    await expect(openZipEntry(html, "a.txt")).rejects.toThrow(/not a ZIP/);
  });
});

describe("sheetRows", () => {
  it("reads prefixed t=str cells by position, entities decoded, empty cells as blanks", async () => {
    const xml = sheetXml([["a", "", "x & y"], ["1 5"]]);
    expect(await collect(sheetRows(chunked(xml)))).toEqual([["a", "", "x & y"], ["1 5"]]);
  });

  it("reads inline strings placed by their cell reference", async () => {
    const xml =
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>a</t></is></c><c r="C1" t="inlineStr"><is><t>c</t></is></c></row>' +
      '<row r="2"><c r="B2"><v>7</v></c></row></sheetData></worksheet>';
    expect(await collect(sheetRows(chunked(xml, 5)))).toEqual([["a", "", "c"], ["", "7"]]);
  });
});

describe("readInfobrasRecords", () => {
  it("skips the title block and yields only the kept columns of every data row", async () => {
    const path = file("ok.xlsx", minimalXlsx([...TITLE, HEADER, ROW, ROW.map((v, i) => (i === 0 ? "36234" : v))]));
    const records = await collect(readInfobrasRecords(path));

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      "Código INFOBRAS": "36233",
      "Estado de ejecución": "En Ejecución",
      "Codigo unico de inversión": "2132947",
      "RUC (Ejecución)": "20301552115",
      "Nombre o razón social de la empresa o consorcio": "A & B S.A.C.",
      "Monto del contrato en soles": "3158683 99",
      "RUC (Supervisión)": "10412345678",
      "Nombre o razón social de la empresa o consorcio #2": "JUAN PEREZ",
    });
    for (const key of Object.keys(records[0]!)) expect(INFOBRAS_HEADERS).toContain(key);
    expect(JSON.stringify(records)).not.toMatch(/MARIA|ROSA/);
  });

  it("works with inline strings too", async () => {
    const path = file("inline.xlsx", minimalXlsx([...TITLE, HEADER, ROW], { inline: true }));
    expect(await collect(readInfobrasRecords(path))).toHaveLength(1);
  });

  it("rejects a file without the expected columns", async () => {
    const path = file("bad.xlsx", minimalXlsx([...TITLE, ["Código INFOBRAS", "Otro"], ["1", "x"]]));
    await expect(collect(readInfobrasRecords(path))).rejects.toThrow(/missing columns: Codigo unico de inversión/);
  });

  it("rejects a file without a header row", async () => {
    const path = file("noheader.xlsx", minimalXlsx(TITLE));
    await expect(collect(readInfobrasRecords(path))).rejects.toThrow(/header row not found/);
  });

  it("reads the committed fixture (rows of the real dataset, person names replaced)", async () => {
    const fixture = fileURLToPath(new URL("../fixtures/infobras-obras-sample.xlsx", import.meta.url));
    const records = await collect(readInfobrasRecords(fixture));
    expect(records.length).toBeGreaterThanOrEqual(20);
    expect(records.every((r) => /^\d+$/.test(r["Código INFOBRAS"] ?? ""))).toBe(true);
  });
});
