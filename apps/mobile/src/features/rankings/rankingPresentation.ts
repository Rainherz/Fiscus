import {
  formatDate,
  formatProgress,
  formatSignedPercent,
  formatSignedSoles,
  formatSoles,
  formatYears,
  yearsSince,
} from '@/shared/format';

import type { Investment, RankingKind } from '../investments/domain/investment';

export const RANKING_OPTIONS: readonly { key: RankingKind; label: string }[] = [
  { key: 'increase-amount', label: 'Mayor aumento (S/)' },
  { key: 'increase-pct', label: 'Mayor aumento (%)' },
  { key: 'cost', label: 'Mayor costo' },
  { key: 'duration', label: 'Más tiempo en curso' },
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
      return `Avance ${formatProgress(investment.executionProgress)}`;
    case 'duration':
      return `Viable desde ${formatDate(investment.viabilityAt)}`;
  }
}

export function rankingNote(kind: RankingKind): string | null {
  switch (kind) {
    case 'increase-pct':
      return 'Solo proyectos aprobados por más de S/ 1 M.';
    case 'duration':
      return 'Proyectos activos, contados desde su fecha de viabilidad.';
    default:
      return null;
  }
}
