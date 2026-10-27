import {
  formatDate,
  formatProgress,
  formatSignedPercent,
  formatSignedSoles,
  formatSoles,
  formatYears,
  yearsSince,
} from '@/shared/format';

import { STALLED_RULE_NOTE } from '../stalled/stalledPresentation';
import type { Investment, RankingKind } from '../investments/domain/investment';
import type { StalledInvestment } from '../investments/domain/stalled';

/** Tabs of the Rankings screen: the investment rankings plus "Sin gasto reciente". */
export type RankingTab = RankingKind | 'stalled';

export const RANKING_TABS: readonly RankingTab[] = [
  'increase-amount',
  'increase-pct',
  'cost',
  'duration',
  'stalled',
];

export function isRankingTab(value: unknown): value is RankingTab {
  return typeof value === 'string' && (RANKING_TABS as readonly string[]).includes(value);
}

/** The rows of the selected tab; "Sin gasto reciente" rows carry their own derived figures. */
export type RankingList =
  | { kind: RankingKind; items: Investment[] }
  | { kind: 'stalled'; items: StalledInvestment[] };

export const RANKING_OPTIONS: readonly { key: RankingTab; label: string }[] = [
  { key: 'increase-amount', label: 'Mayor aumento (S/)' },
  { key: 'increase-pct', label: 'Mayor aumento (%)' },
  { key: 'cost', label: 'Mayor costo' },
  { key: 'duration', label: 'Más tiempo en curso' },
  { key: 'stalled', label: 'Sin gasto reciente' },
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

/** A second factual line under the project name. */
export function rankingDetail(kind: RankingKind, investment: Investment): string {
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
