import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { parse } from "csv-parse";
import type { OpenDataCsvRecord } from "../domain/openData.js";
import type { OpenDataFileInfo, OpenDataSource } from "../ports/OpenDataSource.js";

export const MEF_OPEN_DATA_URL =
  "https://fs.datosabiertos.mef.gob.pe/datastorefiles/DETALLE_INVERSIONES.csv";

/** Free-text column with about 37% of the file's bytes; never needed, so never kept. */
const DROPPED_COLUMNS = new Set(["ALTERNATIVA"]);

/**
 * Streams a MEF open-data CSV (UTF-8 with BOM, every field quoted, header row) as records keyed
 * by header. Dropped columns are discarded by the parser itself.
 */
export function parseOpenDataCsv(input: Readable): AsyncIterable<OpenDataCsvRecord> {
  const parser = parse({
    bom: true,
    columns: (header: string[]) => header.map((name) => (DROPPED_COLUMNS.has(name) ? false : name)),
    skip_empty_lines: true,
  });
  input.on("error", (error) => parser.destroy(error));
  return input.pipe(parser) as AsyncIterable<OpenDataCsvRecord>;
}

export interface OpenDataCsvSourceOptions {
  /** http(s) URL or local file path. Defaults to the MEF URL. */
  location?: string;
  fetch?: typeof fetch;
  /** Cap for the whole download. The file is ~250 MB; GitHub runners fetch it in ~15 s. */
  downloadTimeoutMs?: number;
}

function isHttp(location: string): boolean {
  return /^https?:\/\//i.test(location);
}

function parseHttpDate(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function parseLength(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}

export class OpenDataCsvSource implements OpenDataSource {
  private readonly location: string;
  private readonly fetchImpl: typeof fetch;
  private readonly downloadTimeoutMs: number;

  constructor(options: OpenDataCsvSourceOptions = {}) {
    this.location = options.location ?? MEF_OPEN_DATA_URL;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.downloadTimeoutMs = options.downloadTimeoutMs ?? 15 * 60_000;
  }

  async describe(): Promise<OpenDataFileInfo> {
    if (!isHttp(this.location)) {
      const info = await stat(this.location);
      return { lastModified: info.mtime.toISOString(), contentLength: info.size };
    }
    const response = await this.fetchImpl(this.location, {
      method: "HEAD",
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`HEAD ${this.location} failed: HTTP ${response.status}`);
    return {
      lastModified: parseHttpDate(response.headers.get("last-modified")),
      contentLength: parseLength(response.headers.get("content-length")),
    };
  }

  async *records(): AsyncIterable<OpenDataCsvRecord> {
    yield* parseOpenDataCsv(await this.open());
  }

  private async open(): Promise<Readable> {
    if (!isHttp(this.location)) return createReadStream(this.location);
    const response = await this.fetchImpl(this.location, {
      method: "GET",
      signal: AbortSignal.timeout(this.downloadTimeoutMs),
    });
    if (!response.ok || !response.body) {
      throw new Error(`GET ${this.location} failed: HTTP ${response.status}`);
    }
    return Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>);
  }
}
