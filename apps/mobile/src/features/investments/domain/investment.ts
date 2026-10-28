import type { GovernmentLevel } from './governmentLevel';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Which MEF source owns the figures of a row (`investments.data_source`). */
export type DataSourceKind = 'ssi' | 'open_data';

/** A public investment project (one CUI), as shown in the app. Money is in soles. */
export interface Investment {
  cui: string;
  name: string | null;
  entity: string | null;
  status: string | null;
  situation: string | null;
  function: string | null;
  functionalDivision: string | null;
  functionalGroup: string | null;
  beneficiaries: number | null;
  registeredAt: string | null;
  viabilityAt: string | null;
  firstAccrualMonth: string | null;
  lastAccrualMonth: string | null;
  viableAmount: number | null;
  updatedCost: number | null;
  /**
   * False when updated_cost is missing, a MEF placeholder below S/ 1,000, or below 1% of a
   * positive viable amount. The derived metrics (cost increase, percentage, spent ratio) are
   * null then.
   */
  updatedCostValid: boolean;
  /**
   * True when the accrued total is more than 10 times a valid updated cost (spent ratio > 10):
   * an unusual figure in the MEF source, shown with a notice rather than hidden.
   */
  spentAnomaly: boolean;
  accruedTotal: number | null;
  /** updated_cost - viable_amount */
  costIncrease: number | null;
  /** Percentage on a 0-100 scale of viable_amount. */
  costIncreasePct: number | null;
  /**
   * accrued_total / updated_cost as a ratio: the share of the updated cost already spent
   * (accrued). Not physical progress; may exceed 1.
   */
  executionProgress: number | null;
  /** Null for national investments spanning several departments (shown only nationwide). */
  departmentCode: number | null;
  departmentName: string | null;
  /** When the figures last changed in the MEF source (moves only on real changes). */
  sourceUpdatedAt: string | null;
  governmentLevel: GovernmentLevel | null;
  /** Budget execution unit (open data). */
  executingUnit: string | null;
  province: string | null;
  district: string | null;
  /** Physical progress reported to MEF, 0-100 (open data); null when not reported. */
  physicalProgress: number | null;
  dataSource: DataSourceKind;
  /** Open data location; null when MEF has none or an invalid one (about 23% of projects). */
  coordinates: Coordinates | null;
}

/** The source publishes an updated cost, but it is not usable (see `updatedCostValid`). */
export function hasInvalidUpdatedCost(investment: Investment): boolean {
  return investment.updatedCost !== null && !investment.updatedCostValid;
}

/** How much the accrued total exceeds the updated cost, or null when it does not. */
export function spentOverUpdatedCost(investment: Investment): number | null {
  const { accruedTotal, updatedCost, updatedCostValid } = investment;
  if (!updatedCostValid || accruedTotal === null || updatedCost === null) return null;
  const over = accruedTotal - updatedCost;
  return over > 0 ? over : null;
}

/** Aggregates of one MEF function label within a department. Labels are shown as-is. */
export interface FunctionSummary {
  function: string | null;
  investmentCount: number;
  totalUpdatedCost: number | null;
  totalCostIncrease: number | null;
}

export interface IngestRun {
  startedAt: string;
  finishedAt: string;
}

export type RankingKind = 'increase-amount' | 'increase-pct' | 'cost' | 'duration';

export const RANKING_KINDS: readonly RankingKind[] = [
  'increase-amount',
  'increase-pct',
  'cost',
  'duration',
];
