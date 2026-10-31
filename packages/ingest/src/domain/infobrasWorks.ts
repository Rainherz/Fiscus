import { parseDayMonthYear, parseText, parseYesNo } from "./normalizers.js";
import { parseCode } from "./paralyzedWorks.js";

/**
 * One row of the INFOBRAS open dataset (Contraloría General de la República, "Dataset - Obras
 * Públicas", one row per obra) -> a row of public.infobras_works.
 *
 * Privacy: the dataset names people (the supervisor and resident engineers, and contractors that
 * are natural persons, whose RUC 10 embeds their DNI). Only the columns in INFOBRAS_HEADERS are
 * read; a party whose RUC belongs to a natural person keeps neither name nor RUC, only its kind.
 */

/** Cell text keyed by headerKeys(header row). */
export type InfobrasRecord = Readonly<Record<string, string | undefined>>;

export type PartyKind = "empresa" | "consorcio" | "persona_natural";

export interface Party {
  kind: PartyKind | null;
  /** RUC (11 digits, starting with 20) or OSCE consortium code (C + 10 digits). */
  ruc: string | null;
  name: string | null;
}

export const EXECUTION_STATUSES = ["Finalizado", "En Ejecución", "Sin Ejecución", "Paralizada"] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export interface InfobrasWork {
  infobrasCode: number;
  cui: string | null;
  snip: string | null;
  executionStatus: ExecutionStatus | null;
  hasParalysis: boolean | null;
  paralysisCause: string | null;
  paralysisDate: string | null;
  paralysisDays: number | null;
  /** 0-100 as published. */
  physicalProgressPlanned: number | null;
  physicalProgressActual: number | null;
  /** First day of the month of the last progress report (Año / Mes de avance). */
  progressPeriod: string | null;
  progressRegisteredAt: string | null;
  /** Monto del contrato (ejecución) in soles, as published (see expedienteCostSoles). */
  contractAmount: number | null;
  /**
   * Costo de obra según expediente técnico, in soles: the reference to judge contractAmount, which
   * the source sometimes types without its decimal separator (113862565000 for S/ 113,862,565.00).
   */
  expedienteCostSoles: number | null;
  contractorKind: PartyKind | null;
  contractorRuc: string | null;
  contractorName: string | null;
  supervisorKind: PartyKind | null;
  supervisorRuc: string | null;
  supervisorName: string | null;
  additionalWorksAmount: number | null;
  deductionsAmount: number | null;
  /** N° días de modificaciones de plazo: days added by time extensions. */
  extensionDays: number | null;
  receptionDate: string | null;
  liquidationDate: string | null;
  modality: string | null;
}

/** Header keys (see headerKeys) of the columns the ingest reads. Nothing else leaves the parser. */
export const H = {
  code: "Código INFOBRAS",
  modality: "Modalidad de ejecución de la obra",
  status: "Estado de ejecución",
  cui: "Codigo unico de inversión",
  snip: "Código SNIP",
  contractorRuc: "RUC (Ejecución)",
  contractorName: "Nombre o razón social de la empresa o consorcio",
  contractAmount: "Monto del contrato en soles",
  expedienteCost: "Costo de obra según Expediente técnico",
  expedienteCurrency: "Moneda",
  expedienteCostSoles: "Costo de obra en soles según ET en soles",
  supervisorRuc: "RUC (Supervisión)",
  supervisorName: "Nombre o razón social de la empresa o consorcio #2",
  progressYear: "Año de avance",
  progressMonth: "Mes de avance",
  progressRegisteredAt: "Fecha de registro de avance",
  progressPlanned: "Avance Físico Programado Acumulado (%)",
  progressActual: "Avance Físico Real Acumulado (%)",
  hasParalysis: "Existe Paralización",
  paralysisCause: "Causal de paralización",
  paralysisDate: "Fecha de paralización",
  paralysisDays: "Número de dias paralizado",
  extensionDays: "N° días de modificaciones de plazo",
  additionalWorks: "Monto de adicionales de obra en soles",
  deductions: "Monto de deductivos de obra en soles",
  receptionDate: "Fecha de recepción",
  liquidationDate: "Fecha de aprobación de liquidación de obra",
} as const;

export const INFOBRAS_HEADERS: readonly string[] = Object.values(H);

/** Headers whose absence means the format changed. */
export const REQUIRED_INFOBRAS_HEADERS: readonly string[] = [
  H.code,
  H.cui,
  H.status,
  H.contractorRuc,
  H.contractorName,
  H.supervisorRuc,
  H.supervisorName,
];

/**
 * Header cells -> record keys: whitespace collapsed, a trailing colon dropped, and repeated headers
 * numbered from the second one ("Monto del contrato en soles #2" is the supervision contract).
 */
export function headerKeys(headers: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const base = header.replace(/\s+/g, " ").trim().replace(/\s*:$/, "");
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} #${count}`;
  });
}

/** INFOBRAS writes decimals with a space: "693405 56" is 693405.56. A dot is accepted too. */
export function parseInfobrasDecimal(value: unknown): number | null {
  const text = parseText(value);
  if (text === null) return null;
  const match = /^(-?\d+)(?:[ .](\d+))?$/.exec(text);
  if (!match) return null;
  const parsed = Number(match[2] === undefined ? match[1] : `${match[1]}.${match[2]}`);
  return Number.isFinite(parsed) ? parsed : null;
}

const positiveOrNull = (value: number | null) => (value !== null && value > 0 ? value : null);

function positiveInteger(value: unknown): number | null {
  const parsed = parseInfobrasDecimal(value);
  return parsed !== null && parsed > 0 ? Math.round(parsed) : null;
}

/**
 * Costo de obra en soles según ET; when it is blank or 0, the cost as published if its currency is
 * soles ("S/ Soles"). A cost in another currency without its conversion is unknown (null).
 */
function expedienteCostSoles(record: InfobrasRecord): number | null {
  const soles = positiveOrNull(parseInfobrasDecimal(record[H.expedienteCostSoles]));
  if (soles !== null) return soles;
  const currency = parseText(record[H.expedienteCurrency]);
  if (currency === null || !/soles/i.test(currency)) return null;
  return positiveOrNull(parseInfobrasDecimal(record[H.expedienteCost]));
}

/**
 * Contractor or supervisor name as the app shows it: trimmed, whitespace collapsed, and the word
 * "amp" the source writes for "&" (an escaped ampersand that lost its symbols, "DHMONT amp CG")
 * turned back into "&". Only the lowercase standalone token: "CAMPO", "AMPLIACION" or "AMP" stay.
 */
export function normalizePartyName(value: unknown): string | null {
  const text = parseText(value);
  if (text === null) return null;
  return text
    .split(/\s+/)
    .map((token) => (token === "amp" ? "&" : token))
    .join(" ");
}

const NATURAL_PERSON_RUC = /^1[057]\d{9}$/;
const COMPANY_RUC = /^20\d{9}$/;
const CONSORTIUM_CODE = /^C\d{10}$/;
const CONSORTIUM_NAME = /^CONSORCIO\b/i;

/**
 * Contractor or supervisor: RUC 10, 15 or 17 is a natural person (nothing kept); RUC 20 is a company,
 * or a consortium when its name starts with "CONSORCIO"; an OSCE consortium code (C + 10 digits) is
 * a consortium. Any other identifier keeps only a consortium name, never a name that may be a person.
 */
export function classifyParty(rawRuc: unknown, rawName: unknown): Party {
  const ruc = parseText(rawRuc)?.toUpperCase() ?? null;
  const name = normalizePartyName(rawName);
  const consortiumName = name !== null && CONSORTIUM_NAME.test(name);
  if (ruc !== null && NATURAL_PERSON_RUC.test(ruc)) return { kind: "persona_natural", ruc: null, name: null };
  if (ruc !== null && COMPANY_RUC.test(ruc)) return { kind: consortiumName ? "consorcio" : "empresa", ruc, name };
  if (ruc !== null && CONSORTIUM_CODE.test(ruc)) return { kind: "consorcio", ruc, name };
  if (consortiumName) return { kind: "consorcio", ruc: null, name };
  return { kind: null, ruc: null, name: null };
}

function executionStatus(value: unknown): ExecutionStatus | null {
  const text = parseText(value);
  return EXECUTION_STATUSES.find((status) => status === text) ?? null;
}

/** Año and Mes de avance -> yyyy-mm-01. */
function progressPeriod(year: unknown, month: unknown): string | null {
  const y = positiveInteger(year);
  const m = positiveInteger(month);
  if (y === null || m === null || y < 1990 || y > 2100 || m > 12) return null;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** Null when the row has no INFOBRAS code (it cannot be keyed). */
export function mapInfobrasRecord(record: InfobrasRecord): InfobrasWork | null {
  const code = parseText(record[H.code]);
  if (code === null || !/^\d{1,9}$/.test(code) || Number(code) <= 0) return null;
  const contractor = classifyParty(record[H.contractorRuc], record[H.contractorName]);
  const supervisor = classifyParty(record[H.supervisorRuc], record[H.supervisorName]);
  const hasProgress = parseText(record[H.progressRegisteredAt]) !== null;
  return {
    infobrasCode: Number(code),
    cui: parseCode(record[H.cui]),
    snip: parseCode(record[H.snip]),
    executionStatus: executionStatus(record[H.status]),
    hasParalysis: parseYesNo(record[H.hasParalysis]),
    paralysisCause: parseText(record[H.paralysisCause]),
    paralysisDate: parseDayMonthYear(record[H.paralysisDate]),
    paralysisDays: positiveInteger(record[H.paralysisDays]),
    physicalProgressPlanned: hasProgress ? parseInfobrasDecimal(record[H.progressPlanned]) : null,
    physicalProgressActual: hasProgress ? parseInfobrasDecimal(record[H.progressActual]) : null,
    progressPeriod: progressPeriod(record[H.progressYear], record[H.progressMonth]),
    progressRegisteredAt: parseDayMonthYear(record[H.progressRegisteredAt]),
    contractAmount: positiveOrNull(parseInfobrasDecimal(record[H.contractAmount])),
    expedienteCostSoles: expedienteCostSoles(record),
    contractorKind: contractor.kind,
    contractorRuc: contractor.ruc,
    contractorName: contractor.name,
    supervisorKind: supervisor.kind,
    supervisorRuc: supervisor.ruc,
    supervisorName: supervisor.name,
    additionalWorksAmount: positiveOrNull(parseInfobrasDecimal(record[H.additionalWorks])),
    deductionsAmount: positiveOrNull(parseInfobrasDecimal(record[H.deductions])),
    extensionDays: positiveInteger(record[H.extensionDays]),
    receptionDate: parseDayMonthYear(record[H.receptionDate]),
    liquidationDate: parseDayMonthYear(record[H.liquidationDate]),
    modality: parseText(record[H.modality]),
  };
}

/** Regla de Fiscus: a contract amount above this multiple of the expediente cost is not valid. */
export const CONTRACT_TO_EXPEDIENTE_MAX_RATIO = 10;

/**
 * Regla de Fiscus, the same as infobras_works.contract_amount_valid: a contract amount is not valid
 * when it exceeds 10 times the expediente cost of the same obra (a typing error in the source, such
 * as a missing decimal separator). Amounts without an expediente cost to compare are valid.
 */
export function isContractAmountValid(work: Pick<InfobrasWork, "contractAmount" | "expedienteCostSoles">): boolean {
  const { contractAmount, expedienteCostSoles: cost } = work;
  if (contractAmount === null || cost === null || cost <= 0) return true;
  return contractAmount <= CONTRACT_TO_EXPEDIENTE_MAX_RATIO * cost;
}

/**
 * The date the data describes: the latest "Fecha de registro de avance". The file is regenerated
 * daily, but its content can be months older; dates after the load day (typos) are ignored.
 */
export function dataAsOf(
  works: Iterable<Pick<InfobrasWork, "progressRegisteredAt">>,
  today: string,
): string | null {
  let latest: string | null = null;
  for (const { progressRegisteredAt: date } of works) {
    if (date !== null && date <= today && (latest === null || date > latest)) latest = date;
  }
  return latest;
}
