/** Pure derived metrics. Mirrors the generated columns in the database migration. */

export interface CostFigures {
  viableAmount: number | null;
  updatedCost: number | null;
}

export interface ExecutionFigures {
  accruedTotal: number | null;
  updatedCost: number | null;
}

/** updatedCost − viableAmount. */
export function costIncrease({ viableAmount, updatedCost }: CostFigures): number | null {
  if (viableAmount === null || updatedCost === null) return null;
  return updatedCost - viableAmount;
}

/** Cost increase as a percentage (0–100 scale) of the viable amount. */
export function costIncreasePct(figures: CostFigures): number | null {
  const increase = costIncrease(figures);
  if (increase === null || !figures.viableAmount) return null;
  return (increase / figures.viableAmount) * 100;
}

/** accruedTotal / updatedCost as a ratio (1 = fully accrued). */
export function executionProgress({ accruedTotal, updatedCost }: ExecutionFigures): number | null {
  if (accruedTotal === null || !updatedCost) return null;
  return accruedTotal / updatedCost;
}
