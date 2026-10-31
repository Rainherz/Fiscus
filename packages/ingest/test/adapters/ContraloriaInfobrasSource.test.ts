import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ContraloriaInfobrasSource } from "../../src/adapters/ContraloriaInfobrasSource.js";
import { INFOBRAS_DATASETS_URL } from "../../src/domain/infobrasDataSets.js";

const fixturePath = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const PAGE = readFileSync(fixturePath("infobras-datasets.html"), "utf8");
const XLSX = new Uint8Array(readFileSync(fixturePath("infobras-obras-sample.xlsx")));
const FILE_URL =
  "https://infobras.contraloria.gob.pe/InfobrasWeb/Archivo/DownloadFile?filename=DataSet-Obras-Publicas%2030-10-2026" +
  "&name=DataSet-Obras-Publicas%2030-10-2026" +
  "&contentType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet&extension=.xlsx";

interface FakePage {
  status?: number;
  body: string | Uint8Array;
  contentLength?: number;
}

/** A fetch that serves pages by URL, records requests and whether each body was read. */
function fakeFetch(pages: Record<string, FakePage>) {
  const requests: Array<{ url: string; method: string }> = [];
  let bodiesRead = 0;
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, method: init?.method ?? "GET" });
    const page = pages[url];
    if (!page) return new Response("not found", { status: 404 });
    const bytes = typeof page.body === "string" ? new TextEncoder().encode(page.body) : page.body;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          bodiesRead++;
          controller.enqueue(bytes);
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    return new Response(body, {
      status: page.status ?? 200,
      headers: { "content-length": String(page.contentLength ?? bytes.length) },
    });
  }) as typeof globalThis.fetch;
  return { fetch, requests, bodiesRead: () => bodiesRead };
}

const SITE = {
  [INFOBRAS_DATASETS_URL]: { body: PAGE },
  [FILE_URL]: { body: XLSX },
};

describe("ContraloriaInfobrasSource", () => {
  it("reads the current file link from the DataSets page", async () => {
    const { fetch, requests } = fakeFetch(SITE);
    const link = await new ContraloriaInfobrasSource({ fetch }).latestDataSet();
    expect(link).toMatchObject({ url: FILE_URL, filename: "DataSet-Obras-Publicas 30-10-2026", fileDate: "2026-10-30" });
    expect(requests).toEqual([{ url: INFOBRAS_DATASETS_URL, method: "GET" }]);
  });

  it("fails when the page links no obras dataset", async () => {
    const { fetch } = fakeFetch({ [INFOBRAS_DATASETS_URL]: { body: "<html>Mantenimiento</html>" } });
    await expect(new ContraloriaInfobrasSource({ fetch }).latestDataSet()).rejects.toThrow(/no obras dataset/);
  });

  it("downloads the file to a temporary file, streams its records and deletes it", async () => {
    const { fetch } = fakeFetch(SITE);
    const source = new ContraloriaInfobrasSource({ fetch });
    const file = await source.download(await source.latestDataSet());

    expect(file).not.toBeNull();
    expect(file!.bytes).toBe(XLSX.length);
    expect(statSync(file!.path).size).toBe(XLSX.length);
    let count = 0;
    for await (const _ of source.records(file!.path)) count++;
    expect(count).toBeGreaterThanOrEqual(20);
    await file!.cleanup();
    expect(existsSync(file!.path)).toBe(false);
  });

  it("does not read the body when the Content-Length equals the last file's", async () => {
    const { fetch, bodiesRead } = fakeFetch(SITE);
    const source = new ContraloriaInfobrasSource({ fetch });
    const file = await source.download(await source.latestDataSet(), { skipIfLength: XLSX.length });
    expect(file).toBeNull();
    expect(bodiesRead()).toBe(1); // the page only
  });

  it("fails on an HTTP error and on a truncated download", async () => {
    const link = { url: FILE_URL, filename: "x", fileDate: null };
    const down = fakeFetch({ [FILE_URL]: { status: 503, body: "busy" } });
    await expect(new ContraloriaInfobrasSource({ fetch: down.fetch }).download(link)).rejects.toThrow(/HTTP 503/);
    const short = fakeFetch({ [FILE_URL]: { body: XLSX.slice(0, 100), contentLength: XLSX.length } });
    await expect(new ContraloriaInfobrasSource({ fetch: short.fetch }).download(link)).rejects.toThrow(/truncated/);
  });

  it("uses a local page and a local file without any request (manual runs)", async () => {
    const { fetch, requests } = fakeFetch({});
    const source = new ContraloriaInfobrasSource({ fetch, page: fixturePath("infobras-datasets.html") });
    expect((await source.latestDataSet()).filename).toBe("DataSet-Obras-Publicas 30-10-2026");
    const local = { url: fixturePath("infobras-obras-sample.xlsx"), filename: "local", fileDate: null };
    const file = await source.download(local);
    expect(file).toMatchObject({ path: local.url, bytes: XLSX.length });
    await file!.cleanup();
    expect(existsSync(local.url)).toBe(true);
    expect(requests).toEqual([]);
  });
});
