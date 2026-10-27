import type { Investment } from './investment';
import type { StalledInvestment } from './stalled';

/**
 * One department in the "Regiones" comparison. Cost figures only use investments with a valid
 * updated cost; the increase total counts positive increases only (reductions are excluded).
 *
 * Keep in sync with supabase/migrations/20261030000000_create_region_comparison.sql.
 */
export interface RegionComparison {
  departmentCode: number;
  departmentName: string | null;
  projectCount: number;
  activeCount: number;
  /** Investments with a valid updated cost: the base of every cost figure below. */
  validCostCount: number;
  totalViableAmount: number | null;
  totalUpdatedCost: number | null;
  /** Sum of positive cost increases; 0 when there are none. */
  totalCostIncrease: number;
  projectsWithIncrease: number;
  /** totalCostIncrease over the viable amount of the same projects, 0-100 scale; null without increases. */
  costIncreasePct: number | null;
  /** Accrued total above a valid updated cost (spent ratio > 1). */
  overspentCount: number;
  /** "Sin gasto reciente" projects (see domain/stalled). */
  stalledCount: number;
  stalledPendingAmount: number;
}

export type RegionSort = 'increase-amount' | 'increase-pct' | 'stalled' | 'overspent';

export const REGION_SORTS: readonly RegionSort[] = ['increase-amount', 'increase-pct', 'stalled', 'overspent'];

type SortKey = 'totalCostIncrease' | 'costIncreasePct' | 'stalledCount' | 'stalledPendingAmount' | 'overspentCount';

/** Metrics compared in sequence, largest first, nulls last; ties end in department code order. */
const SORT_KEYS: Record<RegionSort, SortKey[]> = {
  'increase-amount': ['totalCostIncrease'],
  'increase-pct': ['costIncreasePct'],
  stalled: ['stalledCount', 'stalledPendingAmount'],
  overspent: ['overspentCount'],
};

export function rankRegions(regions: readonly RegionComparison[], sort: RegionSort): RegionComparison[] {
  const keys = SORT_KEYS[sort];
  return [...regions].sort((a, b) => {
    for (const key of keys) {
      const x = a[key];
      const y = b[key];
      if (x === y) continue;
      if (x === null) return 1;
      if (y === null) return -1;
      return y - x;
    }
    return a.departmentCode - b.departmentCode;
  });
}

const sum = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};

function groupByDepartment<T extends { departmentCode: number }>(items: readonly T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) groups.set(item.departmentCode, [...(groups.get(item.departmentCode) ?? []), item]);
  return groups;
}

/** The `region_comparison` view computed in memory, ordered by department code. */
export function computeRegionComparison(
  investments: readonly Investment[],
  stalled: readonly StalledInvestment[],
): RegionComparison[] {
  const stalledByDepartment = groupByDepartment(stalled);
  return [...groupByDepartment(investments)]
    .sort(([a], [b]) => a - b)
    .map(([departmentCode, group]) => {
      const valid = group.filter((i) => i.updatedCostValid);
      const increased = valid.filter((i) => i.costIncrease !== null && i.costIncrease > 0);
      const totalCostIncrease = sum(increased.map((i) => i.costIncrease)) ?? 0;
      const increasedViable = sum(increased.map((i) => i.viableAmount));
      const stalledHere = stalledByDepartment.get(departmentCode) ?? [];
      const names = group.map((i) => i.departmentName).filter((n): n is string => n !== null);
      return {
        departmentCode,
        departmentName: names.length ? names.reduce((a, b) => (b > a ? b : a)) : null,
        projectCount: group.length,
        activeCount: group.filter((i) => i.status === 'ACTIVO').length,
        validCostCount: valid.length,
        totalViableAmount: sum(valid.map((i) => i.viableAmount)),
        totalUpdatedCost: sum(valid.map((i) => i.updatedCost)),
        totalCostIncrease,
        projectsWithIncrease: increased.length,
        costIncreasePct: increasedViable ? (totalCostIncrease / increasedViable) * 100 : null,
        overspentCount: valid.filter((i) => i.executionProgress !== null && i.executionProgress > 1).length,
        stalledCount: stalledHere.length,
        stalledPendingAmount: sum(stalledHere.map((i) => i.pendingAmount)) ?? 0,
      };
    });
}
