/**
 * One recorded value of an investment's cost (`public.investment_cost_changes`). MEF only publishes
 * the current cost, so Fiscus keeps its own record from 2026-10-27 onwards; earlier history is unknown.
 */
export type CostChangeKind =
  /** Value present when recording started. */
  | 'baseline'
  /** The investment appeared in the source after recording started. */
  | 'first_seen'
  /** viable_amount or updated_cost differs from the previous ingest. */
  | 'changed';

export interface CostChange {
  id: number;
  cui: string;
  kind: CostChangeKind;
  observedAt: string;
  sourceUpdatedAt: string | null;
  previousViableAmount: number | null;
  viableAmount: number | null;
  previousUpdatedCost: number | null;
  updatedCost: number | null;
  accruedTotal: number | null;
  /** updated_cost - previous_updated_cost; null unless both are known. */
  updatedCostDelta: number | null;
}

/** A recorded increase of the updated cost, with the investment it belongs to. */
export interface RecentCostIncrease extends CostChange {
  name: string | null;
  /** Department of the investment, shown when listing all of Peru. */
  departmentCode: number | null;
}

/** First day of the record. Shown to readers, so it is a plain calendar date. */
export const COST_HISTORY_START = '2026-10-27';

export function isCostIncrease(change: CostChange): boolean {
  return change.kind === 'changed' && (change.updatedCostDelta ?? 0) > 0;
}

/** The viable amount before and after a recorded change, or null when it did not change. */
export function viableAmountChange(
  change: CostChange,
): { from: number | null; to: number | null } | null {
  if (change.kind !== 'changed' || change.previousViableAmount === change.viableAmount) return null;
  return { from: change.previousViableAmount, to: change.viableAmount };
}
