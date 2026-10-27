import type { GovernmentLevel } from './governmentLevel';
import type { Investment } from './investment';
import type { StalledInvestment } from './stalled';

/**
 * One entity (ministry, regional government, municipality...) in the "Entidades" ranking, within
 * a scope: all of Peru, or only its projects in one department. Figures follow the region
 * comparison: cost figures over valid updated costs, positive increases only.
 *
 * Keep in sync with supabase/migrations/20261101000000_entity_comparison.sql.
 */
export interface EntityComparison {
  entity: string;
  governmentLevel: GovernmentLevel | null;
  /** The department when every project of the entity in the scope is in one; else null. */
  departmentCode: number | null;
  departmentName: string | null;
  projectCount: number;
  validCostCount: number;
  totalUpdatedCost: number | null;
  totalCostIncrease: number;
  projectsWithIncrease: number;
  /** Viable amount of the projects that increased: the base of the percentage. */
  increasedViableAmount: number | null;
  /** totalCostIncrease over increasedViableAmount, 0-100 scale; null without increases. */
  costIncreasePct: number | null;
  overspentCount: number;
  stalledCount: number;
  stalledPendingAmount: number;
}

const sum = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};

const keyOf = (item: Investment) => `${item.governmentLevel ?? ''}\u0000${item.entity ?? ''}`;

function group<T extends Investment>(items: readonly T[], departmentCode: number | undefined): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    if (item.entity === null) continue;
    if (departmentCode !== undefined && item.departmentCode !== departmentCode) continue;
    groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  }
  return groups;
}

/** The `entity_comparison` view computed in memory for one scope (undefined: all of Peru), unsorted. */
export function computeEntityComparison(
  investments: readonly Investment[],
  stalled: readonly StalledInvestment[],
  departmentCode?: number,
): EntityComparison[] {
  const stalledGroups = group(stalled, departmentCode);
  return [...group(investments, departmentCode)].map(([key, projects]) => {
    const [first] = projects;
    const valid = projects.filter((i) => i.updatedCostValid);
    const increased = valid.filter((i) => i.costIncrease !== null && i.costIncrease > 0);
    const totalCostIncrease = sum(increased.map((i) => i.costIncrease)) ?? 0;
    const increasedViableAmount = sum(increased.map((i) => i.viableAmount));
    const codes = new Set(projects.map((i) => i.departmentCode));
    const single = codes.size === 1 && first.departmentCode !== null;
    const stalledHere = stalledGroups.get(key) ?? [];
    return {
      entity: first.entity as string,
      governmentLevel: first.governmentLevel,
      departmentCode: single ? first.departmentCode : null,
      departmentName: single ? first.departmentName : null,
      projectCount: projects.length,
      validCostCount: valid.length,
      totalUpdatedCost: sum(valid.map((i) => i.updatedCost)),
      totalCostIncrease,
      projectsWithIncrease: increased.length,
      increasedViableAmount,
      costIncreasePct: increasedViableAmount ? (totalCostIncrease / increasedViableAmount) * 100 : null,
      overspentCount: valid.filter((i) => i.executionProgress !== null && i.executionProgress > 1).length,
      stalledCount: stalledHere.length,
      stalledPendingAmount: sum(stalledHere.map((i) => i.pendingAmount)) ?? 0,
    };
  });
}
