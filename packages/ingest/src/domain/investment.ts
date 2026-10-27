import { departmentName } from "./departments.js";
import { costIncrease, costIncreasePct, executionProgress } from "./metrics.js";
import {
  parseDayMonthYear,
  parseInteger,
  parseNumber,
  parseText,
  parseYearMonth,
} from "./normalizers.js";

/** A public investment project (one row of the MEF SSI report), normalized. */
export interface Investment {
  cui: string;
  snipCode: string | null;
  name: string | null;
  governmentLevel: string | null;
  sector: string | null;
  entity: string | null;
  status: string | null;
  situation: string | null;
  beneficiaries: number | null;
  /** ISO date yyyy-mm-dd */
  registeredAt: string | null;
  /** ISO date yyyy-mm-dd */
  viabilityAt: string | null;
  investmentType: string | null;
  function: string | null;
  functionalDivision: string | null;
  functionalGroup: string | null;
  framework: string | null;
  viableAmount: number | null;
  pim: number | null;
  /** Year taken from the "PIM yyyy" header; unverified against the report date. */
  pimYear: number | null;
  accruedYear: number | null;
  /** ISO date of the first day of the month */
  firstAccrualMonth: string | null;
  /** ISO date of the first day of the month */
  lastAccrualMonth: string | null;
  accruedTotal: number | null;
  updatedCost: number | null;
  disputeCost: number | null;
  guaranteeAmount: number | null;
  concurrentControlCost: number | null;
  departmentCode: number;
  departmentName: string | null;
  /** ISO timestamp from the report header ("Fecha: ..."). */
  sourceUpdatedAt: string | null;
  costIncrease: number | null;
  costIncreasePct: number | null;
  executionProgress: number | null;
}

export type RawField =
  | "cui"
  | "snipCode"
  | "name"
  | "governmentLevel"
  | "sector"
  | "entity"
  | "status"
  | "situation"
  | "beneficiaries"
  | "registeredAt"
  | "viabilityAt"
  | "investmentType"
  | "function"
  | "functionalDivision"
  | "functionalGroup"
  | "framework"
  | "viableAmount"
  | "pim"
  | "accruedYear"
  | "firstAccrualMonth"
  | "lastAccrualMonth"
  | "accruedTotal"
  | "updatedCost"
  | "disputeCost"
  | "guaranteeAmount"
  | "concurrentControlCost";

/** Untyped cell values keyed by domain field, as extracted by a source adapter. */
export type RawInvestmentRecord = Partial<Record<RawField, unknown>>;

export interface NormalizationContext {
  departmentCode: number;
  sourceUpdatedAt: string | null;
  pimYear: number | null;
}

/** Returns null when the record has no CUI (it cannot be keyed). */
export function normalizeInvestment(
  raw: RawInvestmentRecord,
  context: NormalizationContext,
): Investment | null {
  const cui = parseText(raw.cui);
  if (cui === null) return null;

  const viableAmount = parseNumber(raw.viableAmount);
  const updatedCost = parseNumber(raw.updatedCost);
  const accruedTotal = parseNumber(raw.accruedTotal);

  return {
    cui,
    snipCode: parseText(raw.snipCode),
    name: parseText(raw.name),
    governmentLevel: parseText(raw.governmentLevel),
    sector: parseText(raw.sector),
    entity: parseText(raw.entity),
    status: parseText(raw.status),
    situation: parseText(raw.situation),
    beneficiaries: parseInteger(raw.beneficiaries),
    registeredAt: parseDayMonthYear(raw.registeredAt),
    viabilityAt: parseDayMonthYear(raw.viabilityAt),
    investmentType: parseText(raw.investmentType),
    function: parseText(raw.function),
    functionalDivision: parseText(raw.functionalDivision),
    functionalGroup: parseText(raw.functionalGroup),
    framework: parseText(raw.framework),
    viableAmount,
    pim: parseNumber(raw.pim),
    pimYear: context.pimYear,
    accruedYear: parseNumber(raw.accruedYear),
    firstAccrualMonth: parseYearMonth(raw.firstAccrualMonth),
    lastAccrualMonth: parseYearMonth(raw.lastAccrualMonth),
    accruedTotal,
    updatedCost,
    disputeCost: parseNumber(raw.disputeCost),
    guaranteeAmount: parseNumber(raw.guaranteeAmount),
    concurrentControlCost: parseNumber(raw.concurrentControlCost),
    departmentCode: context.departmentCode,
    departmentName: departmentName(context.departmentCode),
    sourceUpdatedAt: context.sourceUpdatedAt,
    costIncrease: costIncrease({ viableAmount, updatedCost }),
    costIncreasePct: costIncreasePct({ viableAmount, updatedCost }),
    executionProgress: executionProgress({ accruedTotal, updatedCost }),
  };
}
