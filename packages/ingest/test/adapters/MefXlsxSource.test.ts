import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { MefXlsxSource, MEF_SSI_ENDPOINT } from "../../src/adapters/MefXlsxSource.js";

const fixture = await readFile(new URL("../fixtures/ssi-arequipa-sample.xlsx", import.meta.url));

function xlsxResponse(): Response {
  return new Response(fixture, { status: 200 });
}

function makeSource(fetchImpl: typeof fetch) {
  const sleep = vi.fn(async (_ms: number) => {});
  const source = new MefXlsxSource({ fetch: fetchImpl, sleep, retries: 3, backoffMs: 1000 });
  return { source, sleep };
}

describe("MefXlsxSource", () => {
  it("posts the GR filter for the department and parses the xlsx", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => xlsxResponse());
    const { source } = makeSource(fetchImpl as unknown as typeof fetch);

    const report = await source.fetchDepartment(4);

    expect(report.records).toHaveLength(5);
    expect(report.pimYear).toBe(2023);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(MEF_SSI_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      sect: "",
      plie: "4",
      dpto: 0,
      prov: 0,
      dist: 0,
      tipo: "GR",
    });
    const headers = new Headers(init?.headers);
    expect(headers.get("content-type")).toBe("application/json; charset=UTF-8");
    expect(headers.get("origin")).toBe("https://ofi5.mef.gob.pe");
    expect(headers.get("referer")).toBe("https://ofi5.mef.gob.pe/ssi/Ssi/Index");
    expect(headers.get("user-agent")).toMatch(/Mozilla/);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries with exponential backoff and then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(xlsxResponse());
    const { source, sleep } = makeSource(fetchImpl as unknown as typeof fetch);

    const report = await source.fetchDepartment(15);

    expect(report.records).toHaveLength(5);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]);
  });

  it("gives up after the initial attempt plus the configured retries", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    const { source } = makeSource(fetchImpl as unknown as typeof fetch);

    await expect(source.fetchDepartment(1)).rejects.toThrow(/department 1.*4 attempts.*ECONNRESET/);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("treats a non-xlsx body (e.g. an HTML error page) as a failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>error</html>", { status: 200 }));
    const { source } = makeSource(fetchImpl as unknown as typeof fetch);

    await expect(source.fetchDepartment(2)).rejects.toThrow(/not an xlsx/i);
  });
});
