import ExcelJS from "exceljs";
import type { RawField, RawInvestmentRecord } from "../domain/investment.js";

/**
 * Parser for the MEF "Seguimiento de Inversiones" (SSI) XLSX report.
 * Layout: metadata rows ("Reporte de SSI", "Fecha: ..."), a header row whose
 * first cell is "CUI", then one row per investment.
 */

export interface ParsedSsiReport {
  /** ISO timestamp (Lima, -05:00) taken from the "Fecha: ..." metadata row. */
  sourceUpdatedAt: string | null;
  /** Year found in the "PIM yyyy" header, if any. */
  pimYear: number | null;
  /** Header cells that did not map to a known field (informational). */
  unknownHeaders: string[];
  records: RawInvestmentRecord[];
}

const EXACT_HEADERS: Record<string, RawField> = {
  CUI: "cui",
  "CODIGO SNIP": "snipCode",
  "NOMBRE DE LA INVERSION": "name",
  "NIVEL DE GOBIERNO": "governmentLevel",
  SECTOR: "sector",
  ENTIDAD: "entity",
  ESTADO: "status",
  SITUACION: "situation",
  BENEFICIARIOS: "beneficiaries",
  "FECHA REGISTRO": "registeredAt",
  "FECHA VIABILIDAD": "viabilityAt",
  "TIPO INVERSION": "investmentType",
  FUNCION: "function",
  "DIVISION FUNCIONAL": "functionalDivision",
  "GRUPO FUNCIONAL": "functionalGroup",
  MARCO: "framework",
  "MONTO VIABLE": "viableAmount",
  "PRIMER DEVENGADO": "firstAccrualMonth",
  "ULTIMO DEVENGADO": "lastAccrualMonth",
  "DEVENGADO ACUMULADO": "accruedTotal",
  "COSTO ACTUALIZADO": "updatedCost",
  "COSTO CONTROVERSIAS": "disputeCost",
  "MONTO CARTA FIANZA": "guaranteeAmount",
  "COSTO CONTROL CONCURRENTE": "concurrentControlCost",
};

const PIM_HEADER = /^PIM (\d{4})$/;
const ACCRUED_YEAR_HEADER = /^DEVENGADO (\d{4})$/;

type CellPrimitive = string | number | boolean | Date | null;

/** Flattens any exceljs cell value (hyperlink, rich text, formula, error) to a primitive; "" -> null. */
export function unwrapCellValue(value: unknown): CellPrimitive {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value === "" ? null : value;
  if (typeof value === "number" || typeof value === "boolean" || value instanceof Date) return value;
  if (typeof value === "object") {
    const cell = value as Record<string, unknown>;
    if (Array.isArray(cell.richText)) {
      return unwrapCellValue(
        cell.richText.map((part) => (part as { text?: unknown }).text ?? "").join(""),
      );
    }
    if ("error" in cell) return null;
    if ("result" in cell) return unwrapCellValue(cell.result);
    if ("text" in cell) return unwrapCellValue(cell.text);
  }
  return null;
}

/** "Fecha: 26/10/2026 06:41:38 p. m." -> "2026-10-26T18:41:38-05:00" (Peru has no DST). */
export function parseReportTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match =
    /Fecha:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?/i.exec(
      value,
    );
  if (!match) return null;
  const [, day, month, year, rawHour, minute, second = "00", meridiem] = match;
  let hour = Number(rawHour);
  if (meridiem) {
    const pm = meridiem.toLowerCase() === "p";
    if (hour === 12) hour = pm ? 12 : 0;
    else if (pm) hour += 12;
  }
  const pad = (n: string | number) => String(n).padStart(2, "0");
  return `${year}-${pad(month!)}-${pad(day!)}T${pad(hour)}:${minute}:${second}-05:00`;
}

function headerText(value: unknown): string | null {
  const unwrapped = unwrapCellValue(value);
  if (unwrapped === null) return null;
  return String(unwrapped).trim().replace(/\s+/g, " ").toUpperCase();
}

function firstNonEmptyCellText(row: ExcelJS.Row): string | null {
  for (let c = 1; c <= row.cellCount; c++) {
    const text = headerText(row.getCell(c).value);
    if (text !== null) return text;
  }
  return null;
}

export async function parseSsiReport(data: Uint8Array | ArrayBuffer): Promise<ParsedSsiReport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("SSI report has no worksheet");

  let headerRowNumber = 0;
  let sourceUpdatedAt: string | null = null;
  for (let n = 1; n <= sheet.rowCount && !headerRowNumber; n++) {
    const row = sheet.getRow(n);
    if (firstNonEmptyCellText(row) === "CUI") {
      headerRowNumber = n;
      break;
    }
    row.eachCell((cell) => {
      sourceUpdatedAt ??= parseReportTimestamp(unwrapCellValue(cell.value));
    });
  }
  if (!headerRowNumber) throw new Error("SSI report: header row starting with CUI not found");

  const columns = new Map<number, RawField>();
  const unknownHeaders: string[] = [];
  let pimYear: number | null = null;
  sheet.getRow(headerRowNumber).eachCell((cell, column) => {
    const text = headerText(cell.value);
    if (text === null) return;
    const exact = EXACT_HEADERS[text];
    const pim = PIM_HEADER.exec(text);
    const accruedYear = ACCRUED_YEAR_HEADER.exec(text);
    if (exact) columns.set(column, exact);
    else if (pim) {
      columns.set(column, "pim");
      pimYear = Number(pim[1]);
    } else if (accruedYear) columns.set(column, "accruedYear");
    else unknownHeaders.push(text);
  });

  const records: RawInvestmentRecord[] = [];
  for (let n = headerRowNumber + 1; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const record: RawInvestmentRecord = {};
    let hasValue = false;
    for (const [column, field] of columns) {
      const value = unwrapCellValue(row.getCell(column).value);
      record[field] = value;
      if (value !== null) hasValue = true;
    }
    if (hasValue) records.push(record);
  }

  return { sourceUpdatedAt, pimYear, unknownHeaders, records };
}
