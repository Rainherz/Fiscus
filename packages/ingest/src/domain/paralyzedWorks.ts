import { departmentCodeFromName } from "./departments.js";
import { parseDayMonthYear, parseInteger, parseIsoDate, parseNumber, parseText, parseYesNo } from "./normalizers.js";

/**
 * One row of the Contraloría's Anexo N° 01 ("Base de datos con la lista de obras públicas
 * paralizadas en el territorio nacional") -> a row of public.official_paralyzed_works. The source
 * has no personal names; UNIDAD ORGÁNICA (the Contraloría unit) and the ranges are not kept.
 */

/** Cell values keyed by normalized header (see normalizeHeader), as exceljs reads them. */
export type ParalyzedRecord = Readonly<Record<string, unknown>>;

export interface EditionContext {
  /** yyyy-mm-dd */
  cutoff: string;
  /** yyyy-mm-dd; null when unknown. */
  publishedAt: string | null;
}

export type GovernmentLevel = "GN" | "GR" | "GL";

export interface ParalyzedWork {
  editionCutoff: string;
  publishedAt: string | null;
  infobrasCode: number;
  cui: string | null;
  snip: string | null;
  investmentDescription: string | null;
  obraDescription: string | null;
  entity: string | null;
  governmentLevel: GovernmentLevel | null;
  sector: string | null;
  departmentCode: number | null;
  department: string | null;
  province: string | null;
  district: string | null;
  event: string | null;
  modality: string | null;
  workType: string | null;
  causalCode: number | null;
  causalLabel: string | null;
  /** 0-100 as published. */
  physicalProgress: number | null;
  expedienteCost: number | null;
  remainingWorkBalance: number | null;
  updatedCost: number | null;
  investmentBalance: number | null;
  startYear: number | null;
  /** PLAZO DE EJECUCIÓN: days. */
  executionDays: number | null;
  mefInventory: boolean | null;
  mefInventoryRegisteredAt: string | null;
  situationalReportAt: string | null;
  mefReportUrl: string | null;
  prioritized: boolean | null;
  prioritizedResolutionAt: string | null;
  prioritizedResolutionUrl: string | null;
}

/** Headers the file must have; anything else means the format changed. */
export const REQUIRED_HEADERS = ["CODIGO INFOBRAS", "CUI", "CAUSAL PARALIZACION", "SALDO DE OBRA", "AVANCE FÍSICO"] as const;

/** First line of a header ("SALDO DE OBRA\n(Costo de obra - ...)" -> "SALDO DE OBRA"), upper case. */
export function normalizeHeader(value: unknown): string {
  if (typeof value !== "string") return "";
  return (value.split("\n")[0] ?? "").trim().toUpperCase();
}

/** Days between the Excel epoch (1899-12-30, which absorbs the 1900 leap-year bug) and 1970-01-01. */
const EXCEL_EPOCH_OFFSET = 25569;
const DAY_MS = 86_400_000;

/**
 * A date cell: a Date (exceljs reads date-formatted cells as UTC midnight), an Excel serial number
 * (some cells are not date-formatted), or text (yyyy-mm-dd or dd/mm/yyyy). Null otherwise.
 */
export function excelDate(value: unknown): string | null {
  if (value instanceof Date) return parseDayMonthYear(value);
  if (typeof value === "number") {
    // Serials before 1950 or after 2100 are not dates in this file.
    if (!Number.isFinite(value) || value < 18264 || value > 73415) return null;
    return parseDayMonthYear(new Date(Math.round((value - EXCEL_EPOCH_OFFSET) * DAY_MS)));
  }
  return parseIsoDate(value) ?? parseDayMonthYear(value);
}

/** "2 INCUMPLIMIENTO DE CONTRATO" -> 2 and the text; a causal without a leading number keeps code null. */
export function splitCausal(value: unknown): { code: number | null; label: string | null } {
  const text = parseText(value);
  if (text === null) return { code: null, label: null };
  const match = /^(\d{1,3})\s+(.+)$/.exec(text);
  return match ? { code: Number(match[1]), label: match[2]!.trim() } : { code: null, label: text };
}

/** CUI and SNIP: a positive whole number as text; the source writes 0 for a blank. */
export function parseCode(value: unknown): string | null {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 ? String(value) : null;
  const text = parseText(value);
  return text !== null && /^\d{1,12}$/.test(text) && Number(text) > 0 ? text : null;
}

/** "G. NACIONAL" / "G. REGIONAL" / "G. LOCAL" (or the full words) -> GN / GR / GL. */
export function parseGovernmentLevel(value: unknown): GovernmentLevel | null {
  const text = parseText(value)?.toUpperCase() ?? "";
  if (/\bNACIONAL\b/.test(text)) return "GN";
  if (/\bREGIONAL\b/.test(text)) return "GR";
  if (/\bLOCAL\b/.test(text)) return "GL";
  return null;
}

/** An http(s) URL, or null: the app links to it, so nothing else is kept. */
export function safeUrl(value: unknown): string | null {
  const text = parseText(value);
  return text !== null && /^https?:\/\/\S+$/i.test(text) ? text : null;
}

/** Department name -> code; the source writes Callao as "P. C. DEL CALLAO". */
function departmentCode(name: string | null): number | null {
  if (name !== null && /CALLAO/i.test(name)) return departmentCodeFromName("Callao");
  return departmentCodeFromName(name);
}

function yearOrNull(value: unknown): number | null {
  const year = parseInteger(value);
  return year !== null && year >= 1900 && year <= 2100 ? year : null;
}

/** Null when the row has no INFOBRAS code (it cannot be keyed). */
export function mapParalyzedRecord(record: ParalyzedRecord, edition: EditionContext): ParalyzedWork | null {
  const infobrasCode = parseInteger(record["CODIGO INFOBRAS"]);
  if (infobrasCode === null || infobrasCode <= 0) return null;
  const causal = splitCausal(record["CAUSAL PARALIZACION"]);
  const department = parseText(record.DEPARTAMENTO);
  const days = parseInteger(record["PLAZO DE EJECUCIÓN"]);
  return {
    editionCutoff: edition.cutoff,
    publishedAt: edition.publishedAt,
    infobrasCode,
    cui: parseCode(record.CUI),
    snip: parseCode(record.SNIP),
    investmentDescription: parseText(record["DESCRIPCION DE INVERSION"]),
    obraDescription: parseText(record["DESCRIPCION OBRA"]),
    entity: parseText(record.ENTIDAD),
    governmentLevel: parseGovernmentLevel(record["NIVEL DE GOBIERNO"]),
    sector: parseText(record.SECTOR),
    departmentCode: departmentCode(department),
    department,
    province: parseText(record.PROVINCIA),
    district: parseText(record.DISTRITO),
    event: parseText(record.EVENTO),
    modality: parseText(record["MODALIDAD DE EJECUCIÓN"]),
    workType: parseText(record["TIPO DE OBRA"]),
    causalCode: causal.code,
    causalLabel: causal.label,
    physicalProgress: parseNumber(record["AVANCE FÍSICO"]),
    expedienteCost: parseNumber(record["COSTO DE OBRA SEGÚN EXP. TEC."]),
    remainingWorkBalance: parseNumber(record["SALDO DE OBRA"]),
    updatedCost: parseNumber(record["COSTO ACTUALIZADO"]),
    investmentBalance: parseNumber(record["SALDO DE LA INVERSIÓN"]),
    startYear: yearOrNull(record["AÑO INICIO OBRA"]),
    executionDays: days !== null && days >= 0 ? days : null,
    mefInventory: parseYesNo(record["ESTA EN EL INVENTARIO OBRAS PARALIZADAS MEF"]),
    mefInventoryRegisteredAt: excelDate(record["FECHA DE REGISTRO EN EL INVENTARIO"]),
    situationalReportAt: excelDate(record["FECHA INFORME SITUACIONAL"]),
    mefReportUrl: safeUrl(record["URL INFORME"]),
    prioritized: parseYesNo(record["DENTRO DE LA LISTA PRIORIZADA"]),
    prioritizedResolutionAt: excelDate(record["FECHA RESOLUCION DE LISTA PRIORIZADA"]),
    prioritizedResolutionUrl: safeUrl(record["URL RESOLUCION"]),
  };
}
