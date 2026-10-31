/**
 * Builds the small committed test fixture from a full Contraloría Anexo N° 01 (obras paralizadas).
 * Usage: tsx scripts/build-paralyzed-fixture.ts <anexo-01.xlsx> <out.xlsx>
 * Keeps the header row and about 20 representative rows: the first rows, a blank CUI, several obras
 * of one CUI, a causal without number, an undeclared start year, Excel-serial dates and a
 * prioritized obra. Values are copied as-is (the source has no personal names).
 */
import ExcelJS from "exceljs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: build-paralyzed-fixture.ts <anexo-01.xlsx> <out.xlsx>");
  process.exit(1);
}

const source = new ExcelJS.Workbook();
await source.xlsx.readFile(input);
const sheet = source.worksheets[0];
if (!sheet) throw new Error("no worksheet");

const header = sheet.getRow(1);
const column = (name: string): number => {
  let found = 0;
  header.eachCell((cell, n) => {
    if (typeof cell.value === "string" && cell.value.split("\n")[0]!.trim().toUpperCase() === name) found = n;
  });
  if (!found) throw new Error(`column ${name} not found`);
  return found;
};
const CUI = column("CUI");
const CAUSAL = column("CAUSAL PARALIZACION");
const YEAR = column("AÑO INICIO OBRA");
const REGISTERED = column("FECHA DE REGISTRO EN EL INVENTARIO");
const PRIORITIZED = column("DENTRO DE LA LISTA PRIORIZADA");

const picked = new Set<number>([2, 3, 4, 5, 6, 7, 8, 9]);
const cuiRows = new Map<unknown, number[]>();
const want = { blankCui: 2, noCode: 1, undeclared: 1, serial: 1, prioritized: 2 };
sheet.eachRow((row, n) => {
  if (n === 1) return;
  const cui = row.getCell(CUI).value;
  cuiRows.set(cui, [...(cuiRows.get(cui) ?? []), n]);
  const take = (key: keyof typeof want) => {
    if (want[key] > 0) {
      want[key]--;
      picked.add(n);
    }
  };
  if (cui === 0) take("blankCui");
  if (typeof row.getCell(CAUSAL).value === "string" && !/^\d/.test(String(row.getCell(CAUSAL).value))) take("noCode");
  if (typeof row.getCell(YEAR).value === "string") take("undeclared");
  if (typeof row.getCell(REGISTERED).value === "number") take("serial");
  if (row.getCell(PRIORITIZED).value === "SI") take("prioritized");
});
// One CUI with three obras or more.
const shared = [...cuiRows].find(([cui, rows]) => cui !== 0 && rows.length >= 3);
for (const n of shared?.[1] ?? []) picked.add(n);

const out = new ExcelJS.Workbook();
const target = out.addWorksheet(sheet.name);
const copy = (n: number) => {
  const values = sheet.getRow(n).values as unknown[];
  target.addRow(values.slice(1));
};
copy(1);
for (const n of [...picked].sort((a, b) => a - b)) copy(n);
// Dates are written as dates; serial numbers stay numbers, as in the source.
await out.xlsx.writeFile(output);
console.log(`wrote ${picked.size} rows to ${output}`);
