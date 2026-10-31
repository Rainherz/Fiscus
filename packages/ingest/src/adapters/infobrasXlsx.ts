import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { PassThrough, type Readable } from "node:stream";
import { createInflateRaw } from "node:zlib";
import { SaxesParser } from "saxes";
import {
  H,
  headerKeys,
  INFOBRAS_HEADERS,
  REQUIRED_INFOBRAS_HEADERS,
  type InfobrasRecord,
} from "../domain/infobrasWorks.js";

/**
 * Streaming reader of the INFOBRAS dataset. The XLSX is about 57 MB, but its single worksheet is
 * about 730 MB of XML (191,000 rows of 97 inline cells), far too much for an in-memory workbook.
 * The worksheet entry is inflated from the ZIP on the fly and tokenized with a SAX parser; only the
 * columns in INFOBRAS_HEADERS are kept, so person-name columns never leave this module.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** Streams one entry of a ZIP archive (stored or deflated; ZIP64 is not supported). */
export async function openZipEntry(path: string, entryName: string): Promise<Readable> {
  const handle = await open(path, "r");
  try {
    const { size } = await handle.stat();
    const tailLength = Math.min(size, 22 + 0xffff);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, size - tailLength);
    let eocd = -1;
    for (let i = tailLength - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === EOCD_SIGNATURE) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error(`${path}: not a ZIP archive (an XLSX file was expected)`);
    const centralSize = tail.readUInt32LE(eocd + 12);
    const centralOffset = tail.readUInt32LE(eocd + 16);
    if (centralOffset === 0xffffffff || centralSize === 0xffffffff) throw new Error(`${path}: ZIP64 archives are not supported`);

    const central = Buffer.alloc(centralSize);
    await handle.read(central, 0, centralSize, centralOffset);
    for (let p = 0; p + 46 <= central.length && central.readUInt32LE(p) === CENTRAL_SIGNATURE; ) {
      const method = central.readUInt16LE(p + 10);
      const compressedSize = central.readUInt32LE(p + 20);
      const nameLength = central.readUInt16LE(p + 28);
      const extraLength = central.readUInt16LE(p + 30);
      const commentLength = central.readUInt16LE(p + 32);
      const localOffset = central.readUInt32LE(p + 42);
      const name = central.toString("utf8", p + 46, p + 46 + nameLength);
      p += 46 + nameLength + extraLength + commentLength;
      if (name !== entryName) continue;
      if (compressedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error(`${path}: ZIP64 entries are not supported`);
      if (method !== 0 && method !== 8) throw new Error(`${path}: ${name} uses unsupported compression ${method}`);

      const local = Buffer.alloc(30);
      await handle.read(local, 0, 30, localOffset);
      if (local.readUInt32LE(0) !== LOCAL_SIGNATURE) throw new Error(`${path}: corrupt ZIP entry ${name}`);
      const start = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      if (compressedSize === 0) return new PassThrough().end();
      const raw = createReadStream(path, { start, end: start + compressedSize - 1 });
      const output = method === 8 ? createInflateRaw() : new PassThrough();
      raw.on("error", (error) => output.destroy(error));
      return raw.pipe(output);
    }
    throw new Error(`${path}: entry ${entryName} not found`);
  } finally {
    await handle.close();
  }
}

const localName = (name: string) => name.slice(name.indexOf(":") + 1);

/** "AB12" -> 27 (zero-based column). */
function columnIndex(reference: string): number | null {
  const letters = /^([A-Z]+)\d*$/.exec(reference.toUpperCase())?.[1];
  if (!letters) return null;
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

/**
 * Rows of a worksheet XML stream as arrays of cell text ("" for empty cells). Cells are placed by
 * their r reference when present, otherwise one after another (INFOBRAS writes no references).
 * Values (<v>) and inline strings (<is><t>) are read the same way; the text is not trimmed.
 */
export async function* sheetRows(xml: AsyncIterable<Buffer | string>): AsyncGenerator<string[]> {
  const parser = new SaxesParser();
  const ready: string[][] = [];
  let row: string[] | null = null;
  let column = 0;
  let cell: string | null = null;
  let capture = false;

  parser.on("opentag", (tag) => {
    const name = localName(tag.name);
    if (name === "row") {
      row = [];
      column = 0;
    } else if (name === "c" && row !== null) {
      const reference = tag.attributes.r;
      const index = typeof reference === "string" ? columnIndex(reference) : null;
      if (index !== null && index >= column) column = index;
      cell = "";
    } else if ((name === "v" || name === "t") && cell !== null) {
      capture = true;
    }
  });
  const onText = (text: string) => {
    if (capture) cell += text;
  };
  parser.on("text", onText);
  parser.on("cdata", onText);
  parser.on("closetag", (tag) => {
    const name = localName(tag.name);
    if (name === "v" || name === "t") {
      capture = false;
    } else if (name === "c" && row !== null && cell !== null) {
      while (row.length < column) row.push("");
      row[column] = cell;
      column++;
      cell = null;
    } else if (name === "row" && row !== null) {
      ready.push(row);
      row = null;
    }
  });

  const decoder = new TextDecoder("utf-8");
  for await (const chunk of xml) {
    parser.write(typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true }));
    yield* ready.splice(0);
  }
  parser.write(decoder.decode());
  parser.close();
  yield* ready.splice(0);
}

/** The worksheet the INFOBRAS file has (and the only one). */
export const INFOBRAS_SHEET_ENTRY = "xl/worksheets/sheet1.xml";

/** The header row is the first row with "Código INFOBRAS" among the first rows (a title block precedes it). */
const HEADER_SEARCH_ROWS = 10;

/**
 * Data rows of the INFOBRAS dataset, each with only the columns in INFOBRAS_HEADERS. Rows whose
 * kept cells are all blank are skipped. Throws when the header row or a required column is missing.
 */
export async function* readInfobrasRecords(path: string): AsyncGenerator<InfobrasRecord> {
  const xml = await openZipEntry(path, INFOBRAS_SHEET_ENTRY);
  let kept: Array<[string, number]> | null = null;
  let rowNumber = 0;
  try {
    for await (const cells of sheetRows(xml)) {
      rowNumber++;
      if (kept === null) {
        const keys = headerKeys(cells);
        if (!keys.includes(H.code)) {
          if (rowNumber >= HEADER_SEARCH_ROWS) break;
          continue;
        }
        const missing = REQUIRED_INFOBRAS_HEADERS.filter((name) => !keys.includes(name));
        if (missing.length) throw new Error(`INFOBRAS dataset: missing columns: ${missing.join(", ")}`);
        kept = INFOBRAS_HEADERS.flatMap((name): Array<[string, number]> => {
          const index = keys.indexOf(name);
          return index >= 0 ? [[name, index]] : [];
        });
        continue;
      }
      const record: Record<string, string> = {};
      let filled = false;
      for (const [name, index] of kept) {
        const value = cells[index] ?? "";
        record[name] = value;
        if (value.trim() !== "") filled = true;
      }
      if (filled) yield record;
    }
  } finally {
    xml.destroy();
  }
  if (kept === null) throw new Error(`INFOBRAS dataset: header row not found in the first ${HEADER_SEARCH_ROWS} rows`);
}
