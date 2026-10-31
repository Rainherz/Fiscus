import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { GobPeParalyzedWorksSource, parseParalyzedXlsx } from "../../src/adapters/GobPeParalyzedWorksSource.js";
import { CONTRALORIA_COLLECTION_URL } from "../../src/domain/paralyzedEditions.js";

const fixturePath = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const SAMPLE = fixturePath("contraloria-anexo01-sample.xlsx");
const EDITION_URL =
  "https://www.gob.pe/institucion/contraloria/informes-publicaciones/8489152-informe-de-obras-paralizadas-en-el-territorio-nacional-a-junio-de-2026";
const XLSX_URL =
  "https://cdn.www.gob.pe/uploads/document/file/10466637/8489152-anexo-n-01-base-de-datos-con-la-lista-de-obras-publicas-paralizadas-en-el-territorio-nacional.XLSX?v=1787003153";

/** A fetch that serves the fixtures by URL and records every request. */
function fakeFetch(pages: Record<string, { status?: number; body: string | Uint8Array }>) {
  const requests: string[] = [];
  const fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    requests.push(url);
    const page = pages[url];
    if (!page) return new Response("not found", { status: 404 });
    return new Response(page.body, { status: page.status ?? 200 });
  }) as typeof globalThis.fetch;
  return { fetch, requests };
}

const SITE = {
  [CONTRALORIA_COLLECTION_URL]: { body: readFileSync(fixturePath("contraloria-collection.html"), "utf8") },
  [EDITION_URL]: { body: readFileSync(fixturePath("contraloria-edition.html"), "utf8") },
  [XLSX_URL]: { body: new Uint8Array(readFileSync(SAMPLE)) },
};

describe("parseParalyzedXlsx", () => {
  it("reads every data row keyed by the first line of its header", async () => {
    const records = await parseParalyzedXlsx(readFileSync(SAMPLE));

    expect(records).toHaveLength(19);
    expect(records[1]).toMatchObject({
      "CODIGO INFOBRAS": 80,
      CUI: 2031099,
      "SALDO DE OBRA": 0,
      "CAUSAL PARALIZACION": "2 INCUMPLIMIENTO DE CONTRATO",
    });
    expect(records[1]!["FECHA DE REGISTRO EN EL INVENTARIO"]).toEqual(new Date("2025-11-04T00:00:00.000Z"));
    // A date cell published as a plain serial number stays a number for the domain to read.
    expect(records.at(-1)!["FECHA DE REGISTRO EN EL INVENTARIO"]).toBe(46004);
  });

  it("rejects a spreadsheet without the expected columns", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Data").addRow(["N°", "OBRA", "MONTO"]);
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(parseParalyzedXlsx(bytes)).rejects.toThrow(/missing columns: CODIGO INFOBRAS/);
  });

  it("rejects something that is not a spreadsheet", async () => {
    await expect(parseParalyzedXlsx(Buffer.from("<html>Mantenimiento</html>"))).rejects.toThrow(/not an XLSX/);
  });
});

describe("GobPeParalyzedWorksSource", () => {
  it("finds the latest edition from the collection page and its Anexo N° 01", async () => {
    const { fetch, requests } = fakeFetch(SITE);
    const source = new GobPeParalyzedWorksSource({ fetch });

    const edition = await source.latestEdition();

    expect(edition).toEqual({
      title: "Informe de Obras Paralizadas en el Territorio Nacional a junio de 2026",
      url: EDITION_URL,
      publishedAt: "2026-08-17",
      cutoff: "2026-06-30",
      xlsxUrl: XLSX_URL,
    });
    expect(requests).toEqual([CONTRALORIA_COLLECTION_URL, EDITION_URL]);
  });

  it("downloads and parses the spreadsheet", async () => {
    const { fetch } = fakeFetch(SITE);
    const source = new GobPeParalyzedWorksSource({ fetch });

    const records = await source.records(await source.latestEdition());

    expect(records).toHaveLength(19);
  });

  it("reads a local collection page and a local spreadsheet", async () => {
    const { fetch, requests } = fakeFetch(SITE);
    const source = new GobPeParalyzedWorksSource({ fetch, collection: fixturePath("contraloria-collection.html") });

    const edition = await source.latestEdition();
    const records = await source.records({ ...edition, xlsxUrl: SAMPLE });

    expect(edition.cutoff).toBe("2026-06-30");
    expect(records).toHaveLength(19);
    expect(requests).toEqual([EDITION_URL]);
  });

  it("fails clearly when the page lists no edition", async () => {
    const { fetch } = fakeFetch({ [CONTRALORIA_COLLECTION_URL]: { body: "<html>Mantenimiento</html>" } });
    await expect(new GobPeParalyzedWorksSource({ fetch }).latestEdition()).rejects.toThrow(/no edition/);
  });

  it("fails clearly when the edition has no Anexo N° 01 spreadsheet", async () => {
    const { fetch } = fakeFetch({ ...SITE, [EDITION_URL]: { body: "<p>17 de agosto de 2026</p>" } });
    await expect(new GobPeParalyzedWorksSource({ fetch }).latestEdition()).rejects.toThrow(/Anexo N° 01/);
  });

  it("reports HTTP errors", async () => {
    const { fetch } = fakeFetch({ [CONTRALORIA_COLLECTION_URL]: { status: 503, body: "busy" } });
    await expect(new GobPeParalyzedWorksSource({ fetch }).latestEdition()).rejects.toThrow(/HTTP 503/);
  });
});
