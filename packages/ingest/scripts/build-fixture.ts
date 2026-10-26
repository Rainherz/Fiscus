/**
 * Builds the small committed test fixture from a full MEF SSI report.
 * Usage: tsx scripts/build-fixture.ts <full-report.xlsx> <out.xlsx>
 * Keeps all metadata rows, the header row and a handful of representative data rows.
 */
import ExcelJS from "exceljs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: build-fixture.ts <full-report.xlsx> <out.xlsx>");
  process.exit(1);
}

const source = new ExcelJS.Workbook();
await source.xlsx.readFile(input);
const sheet = source.worksheets[0];
if (!sheet) throw new Error("no worksheet");

let headerRow = 0;
sheet.eachRow((row, n) => {
  if (!headerRow && row.getCell(1).value === "CUI") headerRow = n;
});

const dataRows: number[] = [];
const want = {
  regular: 2,
  emptyCui: 1,
  emptyAccrualMonths: 1,
  nullPim: 1,
};
sheet.eachRow((row, n) => {
  if (n <= headerRow) return;
  const cui = row.getCell(1).value;
  const firstAccrual = row.getCell(20).value;
  const pim = row.getCell(18).value;
  if (cui === "" && want.emptyCui-- > 0) dataRows.push(n);
  else if (cui !== "" && firstAccrual === "" && want.emptyAccrualMonths-- > 0) dataRows.push(n);
  else if (cui !== "" && firstAccrual !== "" && pim === null && want.nullPim-- > 0) dataRows.push(n);
  else if (cui !== "" && firstAccrual !== "" && pim !== null && want.regular-- > 0) dataRows.push(n);
});

const target = new ExcelJS.Workbook();
const out = target.addWorksheet(sheet.name);
const copy = (from: number) => {
  const values = sheet.getRow(from).values as unknown[];
  out.addRow(values.slice(1));
};
for (let n = 1; n <= headerRow; n++) copy(n);
for (const n of dataRows.sort((a, b) => a - b)) copy(n);
out.getCell(4, 1).value = `Nº Registros: ${dataRows.length}`;

await target.xlsx.writeFile(output);
console.log(`header row ${headerRow}, kept data rows ${dataRows.join(",")}`);
