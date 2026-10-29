import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { parse } from "csv-parse";
import type { OpenDataCsvRecord } from "../domain/openData.js";
import type { OpenDataFileInfo, OpenDataSource } from "../ports/OpenDataSource.js";

export const MEF_OPEN_DATA_URL =
  "https://fs.datosabiertos.mef.gob.pe/datastorefiles/DETALLE_INVERSIONES.csv";

/** Every closed investment (GN, GR, GL), ~120 MB; same host and format as the active file. */
export const MEF_CLOSED_DATA_URL =
  "https://fs.datosabiertos.mef.gob.pe/datastorefiles/CIERRE_INVERSIONES.csv";

/** Free-text column with about 37% of the active file's bytes; never needed, so never kept. */
const OPEN_DATA_DROPPED_COLUMNS: ReadonlySet<string> = new Set(["ALTERNATIVA"]);

/** RESPONSABLE_UEI is a person's name: it never leaves the parser. */
export const CLOSED_DATA_DROPPED_COLUMNS: ReadonlySet<string> = new Set(["RESPONSABLE_UEI"]);

/**
 * Streams a MEF open-data CSV (UTF-8 with BOM, every field quoted, header row) as records keyed
 * by header. Dropped columns are discarded by the parser itself.
 */
export function parseOpenDataCsv(
  input: Readable,
  dropped: ReadonlySet<string> = OPEN_DATA_DROPPED_COLUMNS,
): AsyncIterable<OpenDataCsvRecord> {
  const parser = parse({
    bom: true,
    columns: (header: string[]) => header.map((name) => (dropped.has(name) ? false : name)),
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
  /** Columns the parser discards. Defaults to the active file's (ALTERNATIVA). */
  droppedColumns?: ReadonlySet<string>;
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
  private readonly droppedColumns: ReadonlySet<string>;

  constructor(options: OpenDataCsvSourceOptions = {}) {
    this.location = options.location ?? MEF_OPEN_DATA_URL;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.downloadTimeoutMs = options.downloadTimeoutMs ?? 15 * 60_000;
    this.droppedColumns = options.droppedColumns ?? OPEN_DATA_DROPPED_COLUMNS;
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
    yield* parseOpenDataCsv(await this.open(), this.droppedColumns);
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

/** The closed-investments file: its URL by default, and RESPONSABLE_UEI dropped while parsing. */
export function closedDataSource(options: Omit<OpenDataCsvSourceOptions, "droppedColumns"> = {}): OpenDataCsvSource {
  return new OpenDataCsvSource({
    ...options,
    location: options.location ?? MEF_CLOSED_DATA_URL,
    droppedColumns: CLOSED_DATA_DROPPED_COLUMNS,
  });
}
