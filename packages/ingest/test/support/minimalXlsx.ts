import { crc32, deflateRawSync } from "node:zlib";

/**
 * Writes a minimal XLSX in the shape of the INFOBRAS dataset: one worksheet, prefixed SpreadsheetML
 * elements (x:row, x:c), every cell a t="str" value and no cell references. With `inline`, cells are
 * inline strings (<is><t>) with r="A1"-style references instead, the other common layout.
 * Used by the tests and by scripts/build-infobras-fixture.ts.
 */

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

export function sheetXml(rows: readonly (readonly string[])[], options: { inline?: boolean } = {}): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) =>
          options.inline
            ? `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
            : `<x:c t="str"><x:v>${escapeXml(value)}</x:v></x:c>`,
        )
        .join("");
      return options.inline ? `<row r="${r + 1}">${cells}</row>` : `<x:row>${cells}</x:row>`;
    })
    .join("");
  return options.inline
    ? `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
    : `<?xml version="1.0" encoding="utf-8"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>${body}</x:sheetData></x:worksheet>`;
}

const WORKBOOK =
  '<?xml version="1.0" encoding="utf-8"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheets><x:sheet name="Sheet1" sheetId="1" r:id="R1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" /></x:sheets></x:workbook>';
const RELS =
  '<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="/xl/workbook.xml" Id="R0" /></Relationships>';
const WORKBOOK_RELS =
  '<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml" Id="R1" /></Relationships>';
const CONTENT_TYPES =
  '<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml" /><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" /><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" /><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" /></Types>';

/** A ZIP archive of deflated entries (no data descriptors, no ZIP64). */
export function zip(entries: Record<string, string | Uint8Array>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const data = typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content);
    const compressed = deflateRawSync(data);
    const nameBytes = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, compressed);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

export function minimalXlsx(rows: readonly (readonly string[])[], options: { inline?: boolean } = {}): Buffer {
  return zip({
    "xl/workbook.xml": WORKBOOK,
    "xl/worksheets/sheet1.xml": sheetXml(rows, options),
    "_rels/.rels": RELS,
    "xl/_rels/workbook.xml.rels": WORKBOOK_RELS,
    "[Content_Types].xml": CONTENT_TYPES,
  });
}
