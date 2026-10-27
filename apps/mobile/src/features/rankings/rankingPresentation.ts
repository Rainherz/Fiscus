import {
  formatDate,
  formatProgress,
  formatSignedPercent,
  formatSignedSoles,
  formatSoles,
  formatYears,
  yearsSince,
} from '@/shared/format';

import { withRegion } from '../department/scope';
import type { EntityComparison } from '../investments/domain/entityComparison';
import { STALLED_RULE_NOTE } from '../stalled/stalledPresentation';
import type { Investment, RankingKind } from '../investments/domain/investment';
import type { StalledInvestment } from '../investments/domain/stalled';

/**
 * Tabs of the Rankings screen: the investment rankings, "Sin gasto reciente" and "Entidades", all
 * within the selected scope (a region or all of Peru) and government level. The comparison of
 * regions is the region picker (`/region`); an old `?tab=regions` link is not a tab any more, so
 * it opens the default one. The entity drill-down (`/entity`) has the project tabs only.
 */
export type ProjectTab = RankingKind | 'stalled';
export type RankingTab = ProjectTab | 'entities';

export const PROJECT_TABS: readonly ProjectTab[] = ['increase-amount', 'increase-pct', 'cost', 'duration', 'stalled'];

export const RANKING_TABS: readonly RankingTab[] = [...PROJECT_TABS, 'entities'];

export function isRankingTab(value: unknown): value is RankingTab {
  return typeof value === 'string' && (RANKING_TABS as readonly string[]).includes(value);
}

export function isProjectTab(value: unknown): value is ProjectTab {
  return typeof value === 'string' && (PROJECT_TABS as readonly string[]).includes(value);
}

/** The rows of the selected tab; "Sin gasto reciente" rows carry their own derived figures. */
export type RankingList =
  | { kind: RankingKind; items: Investment[] }
  | { kind: 'stalled'; items: StalledInvestment[] }
  | { kind: 'entities'; items: EntityComparison[] };

export const RANKING_OPTIONS: readonly { key: ProjectTab; label: string }[] = [
  { key: 'increase-amount', label: 'Mayor aumento (S/)' },
  { key: 'increase-pct', label: 'Mayor aumento (%)' },
  { key: 'cost', label: 'Mayor costo' },
  { key: 'duration', label: 'Más tiempo en curso' },
  { key: 'stalled', label: 'Sin gasto reciente' },
];

export const RANKINGS_SCREEN_OPTIONS: readonly { key: RankingTab; label: string }[] = [
  ...RANKING_OPTIONS,
  { key: 'entities', label: 'Entidades' },
];

/** The metric a project is ranked by. */
export function rankingValue(kind: RankingKind, investment: Investment, now: Date): string {
  switch (kind) {
    case 'increase-amount':
      return formatSignedSoles(investment.costIncrease);
    case 'increase-pct':
      return formatSignedPercent(investment.costIncreasePct);
    case 'cost':
      return formatSoles(investment.updatedCost);
    case 'duration':
      return formatYears(yearsSince(investment.viabilityAt, now));
  }
}

function detailLine(kind: RankingKind, investment: Investment): string {
  switch (kind) {
    case 'increase-amount':
    case 'increase-pct':
      return `${formatSoles(investment.viableAmount)} → ${formatSoles(investment.updatedCost)}`;
    case 'cost':
      return `Gastado ${formatProgress(investment.executionProgress)} del costo`;
    case 'duration':
      return `Viable desde ${formatDate(investment.viabilityAt)}`;
  }
}

/** A second factual line under the project name; ranking all of Peru, the region leads. */
export function rankingDetail(kind: RankingKind, investment: Investment, options: { national?: boolean } = {}): string {
  const line = detailLine(kind, investment);
  return options.national ? withRegion(investment.departmentCode, line) : line;
}

export function rankingNote(kind: RankingTab): string | null {
  switch (kind) {
    case 'stalled':
      return STALLED_RULE_NOTE;
    case 'increase-pct':
      return 'Solo proyectos aprobados por más de S/ 1 M.';
    case 'duration':
      return 'Proyectos activos, contados desde su fecha de viabilidad.';
    default:
      return null;
  }
}
