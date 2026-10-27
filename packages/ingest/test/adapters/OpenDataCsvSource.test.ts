import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  MEF_OPEN_DATA_URL,
  OpenDataCsvSource,
  parseOpenDataCsv,
} from "../../src/adapters/OpenDataCsvSource.js";
import type { OpenDataCsvRecord } from "../../src/domain/openData.js";

const FIXTURE = fileURLToPath(new URL("../fixtures/open-data-sample.csv", import.meta.url));

async function collect(records: AsyncIterable<OpenDataCsvRecord>): Promise<OpenDataCsvRecord[]> {
  const all: OpenDataCsvRecord[] = [];
  for await (const record of records) all.push(record);
  return all;
}

describe("parseOpenDataCsv", () => {
  it("streams every row of the fixture keyed by header, without the BOM", async () => {
    const records = await collect(parseOpenDataCsv(createReadStream(FIXTURE)));

    expect(records).toHaveLength(30);
    expect(Object.keys(records[0]!)[0]).toBe("NIVEL");
    expect(records[0]).toMatchObject({
      NIVEL: "GR",
      CODIGO_UNICO: "2114611",
      MONTO_VIABLE: "1372738.0",
      ULTIMO_DEVENGADO: "202609",
      UBIGEO: "040112",
    });
  });

  it("drops ALTERNATIVA while parsing", async () => {
    const records = await collect(parseOpenDataCsv(createReadStream(FIXTURE)));
    expect(records.every((r) => !("ALTERNATIVA" in r))).toBe(true);
  });

  it("keeps quoted commas inside a field and empty quoted fields as empty strings", async () => {
    const csv =
      "﻿\"NIVEL\",\"CODIGO_UNICO\",\"NOMBRE_INVERSION\",\"ALTERNATIVA\",\"UBIGEO\"\r\n" +
      "\"GL\",\"1\",\"CAMINO VECINAL, TRAMO 1\",\"texto, largo\",\"\"\r\n";
    const records = await collect(parseOpenDataCsv(Readable.from([csv])));
    expect(records).toEqual([{ NIVEL: "GL", CODIGO_UNICO: "1", NOMBRE_INVERSION: "CAMINO VECINAL, TRAMO 1", UBIGEO: "" }]);
  });

  it("handles a BOM split across chunks", async () => {
    const bytes = Buffer.from("﻿\"NIVEL\",\"CODIGO_UNICO\"\r\n\"GN\",\"7\"\r\n", "utf8");
    const records = await collect(parseOpenDataCsv(Readable.from([bytes.subarray(0, 2), bytes.subarray(2)])));
    expect(records).toEqual([{ NIVEL: "GN", CODIGO_UNICO: "7" }]);
  });
});

function fakeFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: Array<{ url: string; method: string | undefined }> = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method });
    return handler(url, init);
  }) as typeof fetch;
  return { impl, calls };
}

describe("OpenDataCsvSource over HTTP", () => {
  it("defaults to the MEF open-data URL", () => {
    expect(MEF_OPEN_DATA_URL).toBe("https://fs.datosabiertos.mef.gob.pe/datastorefiles/DETALLE_INVERSIONES.csv");
  });

  it("reads Last-Modified and Content-Length with a HEAD request", async () => {
    const { impl, calls } = fakeFetch(
      () =>
        new Response(null, {
          status: 200,
          headers: { "Last-Modified": "Sun, 25 Oct 2026 18:31:25 GMT", "Content-Length": "247423895" },
        }),
    );
    const source = new OpenDataCsvSource({ fetch: impl });

    await expect(source.describe()).resolves.toEqual({
      lastModified: "2026-10-25T18:31:25.000Z",
      contentLength: 247423895,
    });
    expect(calls).toEqual([{ url: MEF_OPEN_DATA_URL, method: "HEAD" }]);
  });

  it("returns nulls when the headers are missing or invalid", async () => {
    const { impl } = fakeFetch(() => new Response(null, { status: 200, headers: { "Last-Modified": "soon" } }));
    await expect(new OpenDataCsvSource({ fetch: impl }).describe()).resolves.toEqual({
      lastModified: null,
      contentLength: null,
    });
  });

  it("fails on a non-OK HEAD", async () => {
    const { impl } = fakeFetch(() => new Response(null, { status: 503 }));
    await expect(new OpenDataCsvSource({ fetch: impl }).describe()).rejects.toThrow(/503/);
  });

  it("streams and parses the GET body", async () => {
    const body = "﻿\"NIVEL\",\"CODIGO_UNICO\",\"ALTERNATIVA\"\r\n\"GR\",\"10\",\"x, y\"\r\n\"GL\",\"11\",\"z\"\r\n";
    const { impl, calls } = fakeFetch(() => new Response(body, { status: 200 }));
    const records = await collect(new OpenDataCsvSource({ fetch: impl, location: "https://example.test/x.csv" }).records());

    expect(records).toEqual([
      { NIVEL: "GR", CODIGO_UNICO: "10" },
      { NIVEL: "GL", CODIGO_UNICO: "11" },
    ]);
    expect(calls).toEqual([{ url: "https://example.test/x.csv", method: "GET" }]);
  });

  it("fails on a non-OK GET", async () => {
    const { impl } = fakeFetch(() => new Response("gone", { status: 404 }));
    await expect(collect(new OpenDataCsvSource({ fetch: impl }).records())).rejects.toThrow(/404/);
  });
});

describe("OpenDataCsvSource over a local file", () => {
  it("describes the file with its modification time and size", async () => {
    const info = await stat(FIXTURE);
    await expect(new OpenDataCsvSource({ location: FIXTURE }).describe()).resolves.toEqual({
      lastModified: info.mtime.toISOString(),
      contentLength: info.size,
    });
  });

  it("streams the file", async () => {
    const records = await collect(new OpenDataCsvSource({ location: FIXTURE }).records());
    expect(records).toHaveLength(30);
  });
});
