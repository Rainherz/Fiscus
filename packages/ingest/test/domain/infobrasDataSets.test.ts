import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findObrasDataSet, INFOBRAS_DATASETS_URL } from "../../src/domain/infobrasDataSets.js";

const html = readFileSync(fileURLToPath(new URL("../fixtures/infobras-datasets.html", import.meta.url)), "utf8");

describe("findObrasDataSet", () => {
  it("finds the obras dataset link, its file name and its date", () => {
    expect(findObrasDataSet(html, INFOBRAS_DATASETS_URL)).toEqual({
      url:
        "https://infobras.contraloria.gob.pe/InfobrasWeb/Archivo/DownloadFile?filename=DataSet-Obras-Publicas%2030-10-2026" +
        "&name=DataSet-Obras-Publicas%2030-10-2026" +
        "&contentType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet&extension=.xlsx",
      filename: "DataSet-Obras-Publicas 30-10-2026",
      fileDate: "2026-10-30",
    });
  });

  it("ignores the other datasets (public-private partnerships)", () => {
    const onlyApp = html.replace(/DataSet-Obras-Publicas/g, "Otro");
    expect(findObrasDataSet(onlyApp, INFOBRAS_DATASETS_URL)).toBeNull();
  });

  it("keeps a file name without a date", () => {
    const link = `<a href="/InfobrasWeb/Archivo/DownloadFile?filename=DataSet-Obras-Publicas&amp;extension=.xlsx">x</a>`;
    expect(findObrasDataSet(link, INFOBRAS_DATASETS_URL)).toMatchObject({
      filename: "DataSet-Obras-Publicas",
      fileDate: null,
    });
  });

  it("is null on a page without dataset links", () => {
    expect(findObrasDataSet("<html><body>Mantenimiento</body></html>", INFOBRAS_DATASETS_URL)).toBeNull();
  });
});
