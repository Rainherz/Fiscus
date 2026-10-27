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
   * False when updated_cost is missing or a MEF placeholder below S/ 1,000. The derived
   * metrics (cost increase, percentage, spent ratio) are null then.
   */
  updatedCostValid: boolean;
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
  departmentCode: number;
  departmentName: string | null;
  sourceUpdatedAt: string | null;
}

/** The source publishes an updated cost, but it is a placeholder (see `updatedCostValid`). */
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
