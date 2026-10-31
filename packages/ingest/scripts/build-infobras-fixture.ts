/**
 * Builds the small committed test fixture from a full INFOBRAS obras dataset.
 * Usage: tsx scripts/build-infobras-fixture.ts <DataSet-Obras-Publicas.xlsx> <out.xlsx>
 *
 * Keeps the 3-row title block, the header and about 20 representative rows (companies, consortia
 * with a RUC and with an OSCE code, natural-person contractor and supervisor, every execution
 * status, a paralysis, reception and liquidation, a CUI of 0, a blank CUI, two obras of one CUI,
 * the decimal quirk, invalid identifiers). The file is written in the source's own layout.
 *
 * Personal data is replaced, never copied: every person-name column, the name and RUC of every
 * natural-person party (RUC 10 / 15 / 17 embeds a DNI) and the free-text comments.
 */
import { writeFileSync } from "node:fs";
import { openZipEntry, sheetRows, INFOBRAS_SHEET_ENTRY } from "../src/adapters/infobrasXlsx.js";
import { headerKeys } from "../src/domain/infobrasWorks.js";
import { minimalXlsx } from "../test/support/minimalXlsx.js";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: build-infobras-fixture.ts <dataset.xlsx> <out.xlsx>");
  process.exit(1);
}

const rows: string[][] = [];
let keys: string[] = [];
const col = (name: string): number => {
  const index = keys.indexOf(name);
  if (index < 0) throw new Error(`column ${name} not found`);
  return index;
};

type Pick = (row: string[]) => boolean;
const picks: Array<[string, Pick]> = [];
const picked = new Set<string>();
const selected: string[][] = [];
const firstByCui = new Map<string, string[]>();
let sharedCui = false;

for await (const cells of sheetRows(await openZipEntry(input, INFOBRAS_SHEET_ENTRY))) {
  if (rows.length < 4) {
    rows.push(cells);
    if (rows.length === 4) {
      keys = headerKeys(cells);
      const v = (row: string[], name: string) => (row[col(name)] ?? "").trim();
      const ruc = "RUC (Ejecución)";
      const supRuc = "RUC (Supervisión)";
      const name = "Nombre o razón social de la empresa o consorcio";
      const status = "Estado de ejecución";
      const cui = "Codigo unico de inversión";
      picks.push(
        ["company with supervision firm", (r) => /^20\d{9}$/.test(v(r, ruc)) && /^20\d{9}$/.test(v(r, supRuc)) && v(r, "Fecha de registro de avance") !== ""],
        ["consortium with RUC", (r) => /^20\d{9}$/.test(v(r, ruc)) && /^CONSORCIO/i.test(v(r, name))],
        ["consortium with OSCE code", (r) => /^C\d{10}$/.test(v(r, ruc))],
        ["natural-person contractor", (r) => /^10\d{9}$/.test(v(r, ruc))],
        ["natural-person supervisor", (r) => /^10\d{9}$/.test(v(r, supRuc))],
        ["paralyzed", (r) => v(r, status) === "Paralizada" && v(r, "Causal de paralización") !== ""],
        ["finished, received and liquidated", (r) => v(r, status) === "Finalizado" && v(r, "Fecha de recepción") !== "" && v(r, "Fecha de aprobación de liquidación de obra") !== ""],
        ["not started", (r) => v(r, status) === "Sin Ejecución"],
        ["in progress with extension", (r) => v(r, status) === "En Ejecución" && v(r, "N° días de modificaciones de plazo") !== "0"],
        ["CUI 0", (r) => v(r, cui) === "0"],
        ["blank CUI", (r) => v(r, cui) === ""],
        ["direct administration", (r) => v(r, "Modalidad de ejecución de la obra") === "Administración directa" && v(r, "Fecha de registro de avance") !== ""],
        ["four decimals", (r) => /^\d+ \d{4}$/.test(v(r, "Monto de adicionales de obra en soles"))],
        ["invalid id, consortium name", (r) => !/^(\d{11}|C\d{10})$/.test(v(r, ruc)) && v(r, ruc) !== "" && /^CONSORCIO/i.test(v(r, name))],
        ["invalid id, other name", (r) => !/^(\d{11}|C\d{10})$/.test(v(r, ruc)) && v(r, ruc) !== "" && v(r, name) !== "" && !/^CONSORCIO/i.test(v(r, name))],
        ["paralysis reported", (r) => v(r, "Existe Paralización") === "Si" && v(r, status) !== "Paralizada"],
        ["deductions", (r) => v(r, "Monto de deductivos de obra en soles") !== "0"],
      );
    }
    continue;
  }
  if (selected.length < 4) {
    selected.push(cells);
    continue;
  }
  for (const [label, pick] of picks) {
    if (!picked.has(label) && pick(cells)) {
      picked.add(label);
      selected.push(cells);
      break;
    }
  }
  const cui = (cells[col("Codigo unico de inversión")] ?? "").trim();
  if (!sharedCui && /^\d{7}$/.test(cui)) {
    const first = firstByCui.get(cui);
    if (first) {
      selected.push(first, cells);
      sharedCui = true;
    } else if (firstByCui.size < 20000) firstByCui.set(cui, cells);
  }
  if (picked.size === picks.length && sharedCui) break;
}

const missing = picks.map(([label]) => label).filter((label) => !picked.has(label));
if (missing.length) console.warn(`not found: ${missing.join(", ")}`);

// Personal data out.
let fake = 0;
const personColumns = keys.flatMap((key, index) => (/^Nombres Apellidos/.test(key) ? [index] : []));
const parties: Array<[number, number]> = [
  [col("RUC (Ejecución)"), col("Nombre o razón social de la empresa o consorcio")],
  [col("RUC (Supervisión)"), col("Nombre o razón social de la empresa o consorcio #2")],
];
const comments = col("Comentarios");
for (const row of selected) {
  for (const index of personColumns) if ((row[index] ?? "").trim() !== "") row[index] = "NOMBRE DE PRUEBA";
  for (const [rucIndex, nameIndex] of parties) {
    const value = (row[rucIndex] ?? "").trim();
    if (/^1[057]\d{9}$/.test(value) || (/^\d{1,10}$/.test(value) && value.startsWith("10"))) {
      row[rucIndex] = `10${String(++fake).padStart(9, "0")}`;
      row[nameIndex] = "PERSONA NATURAL DE PRUEBA";
    } else if (!/^(20\d{9}|C\d{10})$/.test(value) && !/^CONSORCIO/i.test((row[nameIndex] ?? "").trim())) {
      // An invalid identifier may hide a person: its name is replaced too.
      if ((row[nameIndex] ?? "").trim() !== "") row[nameIndex] = "NOMBRE DE PRUEBA";
    }
  }
  row[comments] = "";
}

writeFileSync(output, minimalXlsx([...rows, ...selected]));
console.log(`${selected.length} rows -> ${output}`);
