import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import {
  CONTRALORIA_COLLECTION_URL,
  findAnexo01Url,
  latestEdition,
  parseCollectionEditions,
  parseEditionPublishedAt,
} from "../domain/paralyzedEditions.js";
import { normalizeHeader, REQUIRED_HEADERS, type ParalyzedRecord } from "../domain/paralyzedWorks.js";
import type { ParalyzedEdition, ParalyzedWorksSource } from "../ports/ParalyzedWorksSource.js";
import { unwrapCellValue } from "./ssiReportParser.js";

/** XLSX files are ZIP archives and start with "PK\x03\x04". */
function looksLikeXlsx(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/**
 * The first worksheet of an Anexo N° 01: header row 1, one obra per row. Rows without any value are
 * skipped. Throws when the file is not an XLSX or lacks a required column (the format changed).
 */
export async function parseParalyzedXlsx(bytes: Uint8Array): Promise<ParalyzedRecord[]> {
  if (!looksLikeXlsx(bytes)) throw new Error("Anexo N° 01: not an XLSX file");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Anexo N° 01: no worksheet");

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, column) => {
    headers[column] = normalizeHeader(unwrapCellValue(cell.value));
  });
  const missing = REQUIRED_HEADERS.filter((name) => !headers.includes(name));
  if (missing.length) throw new Error(`Anexo N° 01: missing columns: ${missing.join(", ")}`);

  const records: ParalyzedRecord[] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const record: Record<string, unknown> = {};
    let filled = false;
    headers.forEach((header, column) => {
      if (!header) return;
      const value = unwrapCellValue(row.getCell(column).value);
      record[header] = value;
      if (value !== null) filled = true;
    });
    if (filled) records.push(record);
  });
  return records;
}

export interface GobPeParalyzedWorksSourceOptions {
  fetch?: typeof fetch;
  /** URL or local path of the collection page. Defaults to the Contraloría collection on gob.pe. */
  collection?: string;
  timeoutMs?: number;
}

const isHttp = (location: string) => /^https?:\/\//i.test(location);

/**
 * The Contraloría editions on gob.pe: the collection page lists them, each edition page links its
 * files on cdn.www.gob.pe. Three plain GET requests per run (collection, edition, spreadsheet), with
 * the runtime's default headers.
 */
export class GobPeParalyzedWorksSource implements ParalyzedWorksSource {
  private readonly fetchImpl: typeof fetch;
  private readonly collection: string;
  private readonly timeoutMs: number;

  constructor(options: GobPeParalyzedWorksSourceOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.collection = options.collection ?? CONTRALORIA_COLLECTION_URL;
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async latestEdition(): Promise<ParalyzedEdition> {
    const html = await this.text(this.collection);
    const base = isHttp(this.collection) ? this.collection : CONTRALORIA_COLLECTION_URL;
    const edition = latestEdition(parseCollectionEditions(html, base));
    if (!edition) throw new Error(`no edition of the paralyzed-works report found on ${this.collection}`);
    const page = await this.text(edition.url);
    const xlsxUrl = findAnexo01Url(page);
    if (!xlsxUrl) throw new Error(`no Anexo N° 01 spreadsheet on ${edition.url}`);
    return { ...edition, publishedAt: edition.publishedAt ?? parseEditionPublishedAt(page), xlsxUrl };
  }

  async records(edition: ParalyzedEdition): Promise<ParalyzedRecord[]> {
    return parseParalyzedXlsx(await this.bytes(edition.xlsxUrl));
  }

  private async get(url: string): Promise<Response> {
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
    return response;
  }

  private async text(location: string): Promise<string> {
    return isHttp(location) ? (await this.get(location)).text() : readFile(location, "utf8");
  }

  private async bytes(location: string): Promise<Uint8Array> {
    if (!isHttp(location)) return new Uint8Array(await readFile(location));
    return new Uint8Array(await (await this.get(location)).arrayBuffer());
  }
}
