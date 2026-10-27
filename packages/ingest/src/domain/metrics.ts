/** Pure derived metrics. Mirrors the generated columns in the database migrations. */

/** MEF publishes placeholder updated costs (S/ 1, 3, 10...); anything below this is invalid. */
export const MIN_VALID_UPDATED_COST = 1000;

export interface CostFigures {
  viableAmount: number | null;
  updatedCost: number | null;
}

export interface ExecutionFigures {
  accruedTotal: number | null;
  updatedCost: number | null;
}

export function isValidUpdatedCost(updatedCost: number | null): updatedCost is number {
  return updatedCost !== null && updatedCost >= MIN_VALID_UPDATED_COST;
}

/** updatedCost − viableAmount; null when either is missing or the updated cost is invalid. */
export function costIncrease({ viableAmount, updatedCost }: CostFigures): number | null {
  if (viableAmount === null || !isValidUpdatedCost(updatedCost)) return null;
  return updatedCost - viableAmount;
}

/** Cost increase as a percentage (0–100 scale) of the viable amount. */
export function costIncreasePct(figures: CostFigures): number | null {
  const increase = costIncrease(figures);
  if (increase === null || !figures.viableAmount) return null;
  return (increase / figures.viableAmount) * 100;
}

/** accruedTotal / updatedCost as a ratio (1 = fully accrued; may exceed 1). */
export function executionProgress({ accruedTotal, updatedCost }: ExecutionFigures): number | null {
  if (accruedTotal === null || !isValidUpdatedCost(updatedCost)) return null;
  return accruedTotal / updatedCost;
}
