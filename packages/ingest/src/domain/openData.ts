import { departmentCodeFromName, departmentCodeFromUbigeo, departmentName } from "./departments.js";
import {
  parseCompactYearMonth,
  parseInteger,
  parseIsoDate,
  parseNumber,
  parseText,
} from "./normalizers.js";

/**
 * One row of MEF's open-data file DETALLE_INVERSIONES.csv, keyed by its header names. Only the
 * columns read by mapOpenDataRecord matter; the rest (ALTERNATIVA, OPMI/UF/UEI names, PMI years,
 * F8/F9/F12B flags...) are ignored and never stored.
 */
export type OpenDataCsvRecord = Readonly<Record<string, string | undefined>>;

/** An investment from the open-data file, normalized. */
export interface OpenDataInvestment {
  cui: string;
  snipCode: string | null;
  name: string | null;
  /** GN (national), GR (regional) or GL (local) government. */
  governmentLevel: string | null;
  sector: string | null;
  entity: string | null;
  /** NOMBRE_UEP: the budget execution unit that runs the investment. */
  executingUnit: string | null;
  status: string | null;
  situation: string | null;
  beneficiaries: number | null;
  /** ISO date yyyy-mm-dd */
  registeredAt: string | null;
  /** ISO date yyyy-mm-dd */
  viabilityAt: string | null;
  investmentType: string | null;
  function: string | null;
  /** PROGRAMA: the functional division (same values as the SSI "DIVISION FUNCIONAL"). */
  functionalDivision: string | null;
  /** SUBPROGRAMA: the functional group (same values as the SSI "GRUPO FUNCIONAL"). */
  functionalGroup: string | null;
  framework: string | null;
  viableAmount: number | null;
  updatedCost: number | null;
  /** PIM_ANIO_ACTUAL: current-year modified budget (the SSI "PIM yyyy" column). */
  pim: number | null;
  /** ANIO_PROCESO: the budget year of pim and accruedYear. */
  pimYear: number | null;
  /** DEV_ANIO_ACTUAL: accrued in the current year (the SSI "DEVENGADO yyyy" column). */
  accruedYear: number | null;
  /** DEVEN_ACUMUL_ANIO_ANT: accrued in all previous years. */
  accruedPreviousYears: number | null;
  /** accruedPreviousYears + accruedYear (the SSI "DEVENGADO ACUMULADO"). */
  accruedTotal: number | null;
  /** ISO date of the first day of the month */
  firstAccrualMonth: string | null;
  /** ISO date of the first day of the month */
  lastAccrualMonth: string | null;
  /** SALDO_EJECUTAR as published (can be negative). */
  pendingBalance: number | null;
  disputeCost: number | null;
  guaranteeAmount: number | null;
  concurrentControlCost: number | null;
  /** Physical progress percent (0-100); null when not reported or out of range. */
  physicalProgress: number | null;
  /** Department where the investment is located; null for multi-department or unknown. */
  departmentCode: number | null;
  departmentName: string | null;
  province: string | null;
  district: string | null;
  ubigeo: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Last-Modified of the open-data file. */
  sourceUpdatedAt: string | null;
  /**
   * Start of this ingest run. The database keeps it only when the row is inserted or its data
   * changes, so it reads "last open-data run that brought new data for the investment".
   */
  openDataUpdatedAt: string;
}

export interface OpenDataContext {
  sourceUpdatedAt: string | null;
  /** Start of the ingest run. */
  runAt: string;
}

/** Peru's bounding box. 0.0 (the source's "no coordinates") falls outside it. */
const PERU_BOUNDS = { minLatitude: -19, maxLatitude: 0, minLongitude: -82, maxLongitude: -68 } as const;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Both coordinates when the point lies inside Peru, otherwise null. */
export function peruCoordinates(latitude: number | null, longitude: number | null): Coordinates | null {
  if (latitude === null || longitude === null) return null;
  const inside =
    latitude >= PERU_BOUNDS.minLatitude &&
    latitude < PERU_BOUNDS.maxLatitude &&
    longitude >= PERU_BOUNDS.minLongitude &&
    longitude <= PERU_BOUNDS.maxLongitude;
  return inside ? { latitude, longitude } : null;
}

/** Sum rounded to cents, so binary floating point does not add noise (1459731800.7200003). */
function sumAmounts(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return Math.round(((a ?? 0) + (b ?? 0)) * 100) / 100;
}

function physicalProgress(hasProgress: unknown, value: unknown): number | null {
  if (parseText(hasProgress) !== "SI") return null;
  const percent = parseNumber(value);
  if (percent === null || percent < 0 || percent > 100) return null;
  return percent;
}

function ubigeo(value: unknown): string | null {
  const text = parseText(value);
  return text !== null && /^\d{6}$/.test(text) ? text : null;
}

/** Where an open-data investment is, from the location columns both MEF files share. */
export interface OpenDataLocation {
  departmentCode: number | null;
  departmentName: string | null;
  province: string | null;
  district: string | null;
  ubigeo: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Department from the ubigeo (then the DEPARTAMENTO name), and coordinates only inside Peru.
 * Shared by DETALLE_INVERSIONES.csv and CIERRE_INVERSIONES.csv, which use the same columns.
 */
export function openDataLocation(row: OpenDataCsvRecord): OpenDataLocation {
  const departmentCode =
    departmentCodeFromUbigeo(parseText(row.UBIGEO)) ?? departmentCodeFromName(parseText(row.DEPARTAMENTO));
  const coordinates = peruCoordinates(parseNumber(row.LATITUD), parseNumber(row.LONGITUD));
  return {
    departmentCode,
    departmentName: departmentCode === null ? null : departmentName(departmentCode),
    province: parseText(row.PROVINCIA),
    district: parseText(row.DISTRITO),
    ubigeo: ubigeo(row.UBIGEO),
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
  };
}

/** Returns null when the row has no CUI (it cannot be keyed). */
export function mapOpenDataRecord(
  row: OpenDataCsvRecord,
  context: OpenDataContext,
): OpenDataInvestment | null {
  const cui = parseText(row.CODIGO_UNICO);
  if (cui === null) return null;

  const accruedPreviousYears = parseNumber(row.DEVEN_ACUMUL_ANIO_ANT);
  const accruedYear = parseNumber(row.DEV_ANIO_ACTUAL);
  const location = openDataLocation(row);

  return {
    cui,
    snipCode: parseText(row.CODIGO_SNIP),
    name: parseText(row.NOMBRE_INVERSION),
    governmentLevel: parseText(row.NIVEL),
    sector: parseText(row.SECTOR),
    entity: parseText(row.ENTIDAD),
    executingUnit: parseText(row.NOMBRE_UEP),
    status: parseText(row.ESTADO),
    situation: parseText(row.SITUACION),
    beneficiaries: parseInteger(row.NUM_HABITANTES_BENEF),
    registeredAt: parseIsoDate(row.FECHA_REGISTRO),
    viabilityAt: parseIsoDate(row.FECHA_VIABILIDAD),
    investmentType: parseText(row.TIPO_INVERSION),
    function: parseText(row.FUNCION),
    functionalDivision: parseText(row.PROGRAMA),
    functionalGroup: parseText(row.SUBPROGRAMA),
    framework: parseText(row.MARCO),
    viableAmount: parseNumber(row.MONTO_VIABLE),
    updatedCost: parseNumber(row.COSTO_ACTUALIZADO),
    pim: parseNumber(row.PIM_ANIO_ACTUAL),
    pimYear: parseInteger(row.ANIO_PROCESO),
    accruedYear,
    accruedPreviousYears,
    accruedTotal: sumAmounts(accruedPreviousYears, accruedYear),
    firstAccrualMonth: parseCompactYearMonth(row.PRIMER_DEVENGADO),
    lastAccrualMonth: parseCompactYearMonth(row.ULTIMO_DEVENGADO),
    pendingBalance: parseNumber(row.SALDO_EJECUTAR),
    disputeCost: parseNumber(row.MONTO_LAUDO),
    guaranteeAmount: parseNumber(row.MONTO_FIANZA),
    concurrentControlCost: parseNumber(row.CTRL_CONCURR),
    physicalProgress: physicalProgress(row.TIENE_AVAN_FISICO, row.AVANCE_FISICO),
    ...location,
    sourceUpdatedAt: context.sourceUpdatedAt,
    openDataUpdatedAt: context.runAt,
  };
}
