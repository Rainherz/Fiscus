import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { findObrasDataSet, INFOBRAS_DATASETS_URL, type InfobrasDataSetLink } from "../domain/infobrasDataSets.js";
import type { InfobrasRecord } from "../domain/infobrasWorks.js";
import type { DownloadedDataSet, InfobrasSource } from "../ports/InfobrasSource.js";
import { readInfobrasRecords } from "./infobrasXlsx.js";

export interface ContraloriaInfobrasSourceOptions {
  fetch?: typeof fetch;
  /** URL or local path of the DataSets page. Defaults to the INFOBRAS DataSets page. */
  page?: string;
  /** Parent directory of the temporary download. Defaults to the OS temporary directory. */
  tempDir?: string;
  pageTimeoutMs?: number;
  downloadTimeoutMs?: number;
}

const isHttp = (location: string) => /^https?:\/\//i.test(location);

/**
 * The INFOBRAS open data of the Contraloría: the DataSets page links the obras file, which is
 * streamed to a temporary file (about 57 MB) and read from there. Two plain GET requests per run
 * (page and file), with the runtime's default headers; no cookies or authentication are needed.
 */
export class ContraloriaInfobrasSource implements InfobrasSource {
  private readonly fetchImpl: typeof fetch;
  private readonly page: string;
  private readonly tempDir: string;
  private readonly pageTimeoutMs: number;
  private readonly downloadTimeoutMs: number;

  constructor(options: ContraloriaInfobrasSourceOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.page = options.page ?? INFOBRAS_DATASETS_URL;
    this.tempDir = options.tempDir ?? tmpdir();
    this.pageTimeoutMs = options.pageTimeoutMs ?? 60_000;
    this.downloadTimeoutMs = options.downloadTimeoutMs ?? 15 * 60_000;
  }

  async latestDataSet(): Promise<InfobrasDataSetLink> {
    const html = isHttp(this.page) ? await (await this.get(this.page, this.pageTimeoutMs)).text() : await readFile(this.page, "utf8");
    const link = findObrasDataSet(html, isHttp(this.page) ? this.page : INFOBRAS_DATASETS_URL);
    if (!link) throw new Error(`no obras dataset linked on ${this.page}`);
    return link;
  }

  async download(
    link: InfobrasDataSetLink,
    options: { skipIfLength?: number | null } = {},
  ): Promise<DownloadedDataSet | null> {
    if (!isHttp(link.url)) {
      return { path: link.url, bytes: (await stat(link.url)).size, cleanup: async () => {} };
    }
    const response = await this.get(link.url, this.downloadTimeoutMs);
    const header = response.headers.get("content-length");
    const expected = header !== null && /^\d+$/.test(header) ? Number(header) : null;
    if (expected !== null && options.skipIfLength != null && expected === options.skipIfLength) {
      await response.body?.cancel();
      return null;
    }
    if (!response.body) throw new Error(`GET ${link.url}: empty response`);

    const dir = await mkdtemp(join(this.tempDir, "infobras-"));
    const cleanup = () => rm(dir, { recursive: true, force: true });
    const path = join(dir, "obras.xlsx");
    try {
      await pipeline(Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>), createWriteStream(path));
      const bytes = (await stat(path)).size;
      if (expected !== null && bytes !== expected) {
        throw new Error(`GET ${link.url}: truncated download (${bytes} of ${expected} bytes)`);
      }
      return { path, bytes, cleanup };
    } catch (error) {
      await cleanup();
      throw error;
    }
  }

  records(path: string): AsyncIterable<InfobrasRecord> {
    return readInfobrasRecords(path);
  }

  private async get(url: string, timeoutMs: number): Promise<Response> {
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
    return response;
  }
}
