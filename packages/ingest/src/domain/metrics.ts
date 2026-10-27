/** Pure derived metrics. Mirrors the generated columns in the database migrations. */

/** MEF publishes placeholder updated costs (S/ 1, 3, 10...); anything below this is invalid. */
export const MIN_VALID_UPDATED_COST = 1000;

/**
 * MEF also publishes truncated updated costs (e.g. S/ 4,558 for a S/ 1.99M project). An updated
 * cost below this share of a positive viable amount is invalid too.
 */
export const MIN_UPDATED_COST_RATIO = 0.01;

export interface CostFigures {
  viableAmount: number | null;
  updatedCost: number | null;
}

export interface ExecutionFigures extends CostFigures {
  accruedTotal: number | null;
}

/** Same rule as the generated column investments.updated_cost_valid. */
export function isValidUpdatedCost({ updatedCost, viableAmount }: CostFigures): boolean {
  if (updatedCost === null || updatedCost < MIN_VALID_UPDATED_COST) return false;
  if (viableAmount === null || viableAmount <= 0) return true;
  return updatedCost >= viableAmount * MIN_UPDATED_COST_RATIO;
}

/** updatedCost − viableAmount; null when either is missing or the updated cost is invalid. */
export function costIncrease({ viableAmount, updatedCost }: CostFigures): number | null {
  if (viableAmount === null || updatedCost === null) return null;
  if (!isValidUpdatedCost({ viableAmount, updatedCost })) return null;
  return updatedCost - viableAmount;
}

/** Cost increase as a percentage (0–100 scale) of the viable amount. */
export function costIncreasePct(figures: CostFigures): number | null {
  const increase = costIncrease(figures);
  if (increase === null || !figures.viableAmount) return null;
  return (increase / figures.viableAmount) * 100;
}

/** accruedTotal / updatedCost as a ratio (1 = fully accrued; may exceed 1). */
export function executionProgress({
  accruedTotal,
  updatedCost,
  viableAmount,
}: ExecutionFigures): number | null {
  if (accruedTotal === null || updatedCost === null) return null;
  if (!isValidUpdatedCost({ viableAmount, updatedCost })) return null;
  return accruedTotal / updatedCost;
}
