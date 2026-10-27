import type { RegionComparison } from '@/features/investments/domain/regionComparison';

/** A region_comparison row with plausible defaults, for tests. */
export function regionRow(code: number, values: Partial<RegionComparison> = {}): RegionComparison {
  return {
    departmentCode: code,
    departmentName: null,
    projectCount: 100,
    activeCount: 90,
    validCostCount: 95,
    totalViableAmount: 1_000_000_000,
    totalUpdatedCost: 1_200_000_000,
    totalCostIncrease: 0,
    projectsWithIncrease: 0,
    costIncreasePct: null,
    overspentCount: 0,
    stalledCount: 0,
    stalledPendingAmount: 0,
    ...values,
  };
}
