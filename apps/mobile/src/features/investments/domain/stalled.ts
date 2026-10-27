import type { Investment } from './investment';

/**
 * "Sin gasto reciente": active projects that spent between 5 % and 95 % of a valid updated cost
 * and have no accrual in the last 12 months of MEF data. Months are counted back from the
 * reference month (the latest last_accrual_month in the dataset), not from today, so publication
 * delays in the source do not inflate the list.
 *
 * Keep in sync with supabase/migrations/20261029000000_create_stalled_investments.sql.
 */
export const STALLED_MIN_PROGRESS = 0.05;
export const STALLED_MAX_PROGRESS = 0.95;
/** A project qualifies with strictly more months than this without accrual. */
export const STALLED_MONTHS = 12;

/** An investment that meets the rule, as listed by the "Sin gasto reciente" ranking. */
export interface StalledInvestment extends Investment {
  /** Whole months between the last accrual month and the reference month (always > 12). */
  monthsWithoutAccrual: number;
  /** updated_cost - accrued_total: the part of the updated cost not yet accrued. */
  pendingAmount: number;
}

function monthIndex(value: string | null): number | null {
  const match = value ? /^(\d{4})-(\d{2})/.exec(value) : null;
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
}

/** Whole calendar months from `from` to `to` (date strings, first day of a month). */
export function monthsBetween(from: string | null, to: string | null): number | null {
  const start = monthIndex(from);
  const end = monthIndex(to);
  return start === null || end === null ? null : end - start;
}

/** Last accrual month and months without accrual when the project meets the rule, else null. */
export function stalledStatus(
  investment: Investment,
  referenceMonth: string | null,
): { since: string; months: number } | null {
  const { status, updatedCostValid, executionProgress, lastAccrualMonth } = investment;
  if (status !== 'ACTIVO' || !updatedCostValid || executionProgress === null) return null;
  if (executionProgress < STALLED_MIN_PROGRESS || executionProgress > STALLED_MAX_PROGRESS) return null;
  const months = monthsBetween(lastAccrualMonth, referenceMonth);
  if (lastAccrualMonth === null || months === null || months <= STALLED_MONTHS) return null;
  return { since: lastAccrualMonth, months };
}

export function toStalledInvestment(
  investment: Investment,
  referenceMonth: string | null,
): StalledInvestment | null {
  const status = stalledStatus(investment, referenceMonth);
  if (!status) return null;
  return {
    ...investment,
    monthsWithoutAccrual: status.months,
    pendingAmount: (investment.updatedCost ?? 0) - (investment.accruedTotal ?? 0),
  };
}
