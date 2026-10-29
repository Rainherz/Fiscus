import {
  openDataLocation,
  type OpenDataContext,
  type OpenDataCsvRecord,
  type OpenDataLocation,
} from "./openData.js";
import {
  parseCompactYearMonth,
  parseInteger,
  parseIsoDate,
  parseNumber,
  parseText,
  parseYesNo,
} from "./normalizers.js";

/** Same cap as the investments.closure_description check constraint. */
export const CLOSURE_DESCRIPTION_MAX_LENGTH = 200;

/**
 * An investment from MEF's open-data file CIERRE_INVERSIONES.csv (every closed investment of GN,
 * GR and GL), normalized. Only these columns are stored: RESPONSABLE_UEI (a person's name, dropped
 * by the CSV parser), the OPMI/UF/UEI names, the F8/F9/F12B flags and the other columns are not.
 * The file has no current-year budget, physical progress or pending balance.
 */
export interface ClosedInvestment extends OpenDataLocation {
  cui: string;
  snipCode: string | null;
  name: string | null;
  /** GN (national), GR (regional) or GL (local) government. */
  governmentLevel: string | null;
  sector: string | null;
  entity: string | null;
  /** NOM_UEP: the budget execution unit. */
  executingUnit: string | null;
  /** ESTADO: CERRADO for every row of the file. */
  status: string | null;
  situation: string | null;
  beneficiaries: number | null;
  /** ISO date yyyy-mm-dd */
  registeredAt: string | null;
  /** ISO date yyyy-mm-dd */
  viabilityAt: string | null;
  investmentType: string | null;
  function: string | null;
  /** PROGRAMA: the functional division, as in the active file. */
  functionalDivision: string | null;
  /** SUBPROGRAMA: the functional group. */
  functionalGroup: string | null;
  framework: string | null;
  viableAmount: number | null;
  updatedCost: number | null;
  /** DEVEN_ACUMULADO: accrued over the life of the investment. */
  accruedTotal: number | null;
  /** ISO date of the first day of the month */
  firstAccrualMonth: string | null;
  /** ISO date of the first day of the month */
  lastAccrualMonth: string | null;
  disputeCost: number | null;
  guaranteeAmount: number | null;
  concurrentControlCost: number | null;
  /** FEC_CIERRE, ISO date. */
  closedAt: string | null;
  /** DES_CIERRE, trimmed: the closure type ("Sí, con liquidación", "No culminada"...). */
  closureDescription: string | null;
  /** TOTAL_LIQUIDACION as published (0 happens). */
  liquidationAmount: number | null;
  /** FEC_LIQUIDACION, ISO date. */
  liquidatedAt: string | null;
  /** CULMINADA: SÍ / NO; null when blank. */
  culminated: boolean | null;
  /** INICIO_EJEC_FISICA, ISO date. */
  physicalStartAt: string | null;
  /** CULMINA_EJEC_FISICA, ISO date. */
  physicalEndAt: string | null;
  /** FEC_INI_OPER, ISO date. */
  operationStartAt: string | null;
  /** Last-Modified of the closed file. */
  sourceUpdatedAt: string | null;
  /** Start of this ingest run (kept by the database only when the row's data changes). */
  openDataUpdatedAt: string;
}

function closureDescription(value: unknown): string | null {
  const text = parseText(value);
  return text === null ? null : text.slice(0, CLOSURE_DESCRIPTION_MAX_LENGTH);
}

/** Returns null when the row has no CUI (it cannot be keyed). */
export function mapClosedDataRecord(row: OpenDataCsvRecord, context: OpenDataContext): ClosedInvestment | null {
  const cui = parseText(row.CODIGO_UNICO);
  if (cui === null) return null;

  return {
    cui,
    snipCode: parseText(row.CODIGO_SNIP),
    name: parseText(row.NOMBRE_INVERSION),
    governmentLevel: parseText(row.NIVEL),
    sector: parseText(row.SECTOR),
    entity: parseText(row.ENTIDAD),
    executingUnit: parseText(row.NOM_UEP),
    status: parseText(row.ESTADO),
    situation: parseText(row.SITUACION),
    beneficiaries: parseInteger(row.BENEFICIARIO),
    registeredAt: parseIsoDate(row.FECHA_REGISTRO),
    viabilityAt: parseIsoDate(row.FECHA_VIABILIDAD),
    investmentType: parseText(row.TIPO_INVERSION),
    function: parseText(row.FUNCION),
    functionalDivision: parseText(row.PROGRAMA),
    functionalGroup: parseText(row.SUBPROGRAMA),
    framework: parseText(row.MARCO),
    viableAmount: parseNumber(row.MONTO_VIABLE),
    updatedCost: parseNumber(row.COSTO_ACTUALIZADO),
    accruedTotal: parseNumber(row.DEVEN_ACUMULADO),
    firstAccrualMonth: parseCompactYearMonth(row.PRIMER_DEVENGADO),
    lastAccrualMonth: parseCompactYearMonth(row.ULTIMO_DEVENGADO),
    disputeCost: parseNumber(row.MONTO_LAUDO),
    guaranteeAmount: parseNumber(row.MONTO_FIANZA),
    concurrentControlCost: parseNumber(row.CONTROL_CONCURR),
    ...openDataLocation(row),
    closedAt: parseIsoDate(row.FEC_CIERRE),
    closureDescription: closureDescription(row.DES_CIERRE),
    liquidationAmount: parseNumber(row.TOTAL_LIQUIDACION),
    liquidatedAt: parseIsoDate(row.FEC_LIQUIDACION),
    culminated: parseYesNo(row.CULMINADA),
    physicalStartAt: parseIsoDate(row.INICIO_EJEC_FISICA),
    physicalEndAt: parseIsoDate(row.CULMINA_EJEC_FISICA),
    operationStartAt: parseIsoDate(row.FEC_INI_OPER),
    sourceUpdatedAt: context.sourceUpdatedAt,
    openDataUpdatedAt: context.runAt,
  };
}
