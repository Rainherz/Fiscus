import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findAnexo01Url,
  latestEdition,
  parseCollectionEditions,
  parseEditionCutoff,
  parseEditionPublishedAt,
  parseSpanishDate,
} from "../../src/domain/paralyzedEditions.js";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");
const COLLECTION_URL = "https://www.gob.pe/institucion/contraloria/colecciones/18230-obras-paralizadas-documentos";

describe("parseSpanishDate", () => {
  it("reads gob.pe dates", () => {
    expect(parseSpanishDate("17 de agosto de 2026")).toBe("2026-08-17");
    expect(parseSpanishDate(" 1 de julio de 2023")).toBe("2023-07-01");
    expect(parseSpanishDate("28 de setiembre de 2024")).toBe("2024-09-28");
    expect(parseSpanishDate("28 de septiembre de 2024")).toBe("2024-09-28");
  });

  it("rejects anything else", () => {
    expect(parseSpanishDate("31 de febrero de 2026")).toBeNull();
    expect(parseSpanishDate("agosto de 2026")).toBeNull();
    expect(parseSpanishDate("")).toBeNull();
  });
});

describe("parseEditionCutoff", () => {
  it("is the last day of the month in the title, with or without 'de'", () => {
    expect(parseEditionCutoff("Informe de Obras Paralizadas en el Territorio Nacional a junio de 2026")).toBe("2026-06-30");
    expect(parseEditionCutoff("Informe de Obras Paralizadas en el Territorio Nacional a marzo 2026")).toBe("2026-03-31");
    expect(parseEditionCutoff("Informe de Obras Paralizadas en el Territorio Nacional a setiembre 2024")).toBe("2024-09-30");
    expect(parseEditionCutoff("Reporte de obras paralizadas en el territorio nacional a febrero 2024")).toBe("2024-02-29");
  });

  it("ignores titles that are not an edition of the report", () => {
    expect(parseEditionCutoff("Existen 2346 obras paralizadas por más de S/ 29 mil millones")).toBeNull();
    expect(parseEditionCutoff("Reporte de obras paralizadas en el territorio nacional II trimestre 2022")).toBeNull();
  });
});

describe("parseCollectionEditions", () => {
  it("lists every edition card with its absolute URL, publication date and cut-off", () => {
    const editions = parseCollectionEditions(fixture("contraloria-collection.html"), COLLECTION_URL);

    expect(editions).toHaveLength(4);
    expect(editions).toContainEqual({
      title: "Informe de Obras Paralizadas en el Territorio Nacional a junio de 2026",
      url: "https://www.gob.pe/institucion/contraloria/informes-publicaciones/8489152-informe-de-obras-paralizadas-en-el-territorio-nacional-a-junio-de-2026",
      publishedAt: "2026-08-17",
      cutoff: "2026-06-30",
    });
    expect(editions.map((e) => e.cutoff)).toEqual(["2026-03-31", "2026-06-30", "2024-09-30", "2023-06-30"]);
  });

  it("returns nothing for a page without cards", () => {
    expect(parseCollectionEditions("<html><body>Mantenimiento</body></html>", COLLECTION_URL)).toEqual([]);
  });
});

describe("latestEdition", () => {
  it("picks the latest cut-off, not the first card", () => {
    const editions = parseCollectionEditions(fixture("contraloria-collection.html"), COLLECTION_URL);
    expect(latestEdition(editions)?.cutoff).toBe("2026-06-30");
  });

  it("prefers the latest publication for the same cut-off, and is null without editions", () => {
    const base = { title: "t", url: "u", cutoff: "2026-06-30" };
    expect(
      latestEdition([
        { ...base, url: "old", publishedAt: "2026-08-01" },
        { ...base, url: "new", publishedAt: "2026-08-17" },
      ])?.url,
    ).toBe("new");
    expect(latestEdition([])).toBeNull();
  });
});

describe("edition page", () => {
  it("finds the Anexo N° 01 spreadsheet, not the report or Anexo N° 02", () => {
    expect(findAnexo01Url(fixture("contraloria-edition.html"))).toBe(
      "https://cdn.www.gob.pe/uploads/document/file/10466637/8489152-anexo-n-01-base-de-datos-con-la-lista-de-obras-publicas-paralizadas-en-el-territorio-nacional.XLSX?v=1787003153",
    );
  });

  it("decodes entities in the link and accepts lowercase extensions", () => {
    const html = '<a href="https://cdn.www.gob.pe/uploads/document/file/1/9-anexo-n-01-obras.xlsx?v=1&amp;x=2">x</a>';
    expect(findAnexo01Url(html)).toBe("https://cdn.www.gob.pe/uploads/document/file/1/9-anexo-n-01-obras.xlsx?v=1&x=2");
  });

  it("is null when there is no Anexo N° 01 spreadsheet", () => {
    const html = '<a href="https://cdn.www.gob.pe/uploads/document/file/1/9-anexo-n-01-obras.PDF">x</a>';
    expect(findAnexo01Url(html)).toBeNull();
  });

  it("reads the publication date under the heading", () => {
    expect(parseEditionPublishedAt(fixture("contraloria-edition.html"))).toBe("2026-08-17");
    expect(parseEditionPublishedAt("<p>sin fecha</p>")).toBeNull();
  });
});
