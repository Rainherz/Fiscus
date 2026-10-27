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
  accruedTotal: number | null;
  /** updated_cost - viable_amount */
  costIncrease: number | null;
  /** Percentage on a 0-100 scale of viable_amount. */
  costIncreasePct: number | null;
  /** accrued_total / updated_cost as a ratio (1 = fully accrued; may exceed 1). */
  executionProgress: number | null;
  departmentCode: number;
  departmentName: string | null;
  sourceUpdatedAt: string | null;
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
