import type { StalledInvestment } from '@/features/investments/domain/stalled';
import { formatInteger, formatMonthShort, formatProgress, formatSolesCompact } from '@/shared/format';

export const STALLED_TITLE = 'SIN GASTO RECIENTE';
export const STALLED_RULE_NOTE =
  'Proyectos activos que gastaron entre 5 % y 95 % de su costo y no registran gasto en los ' +
  'últimos 12 meses de datos del MEF.';
export const STALLED_EMPTY = 'No hay proyectos activos sin gasto en los últimos 12 meses.';

/** Two factual lines under the project name: since when, how much was spent and how much is left. */
export function stalledRowDetail(item: StalledInvestment): [string, string] {
  return [
    `Sin gasto desde ${formatMonthShort(item.lastAccrualMonth)}`,
    `Gastó ${formatProgress(item.executionProgress)} · ${formatSolesCompact(item.pendingAmount)} por ejecutar`,
  ];
}

/** Line on the detail screen for a project that meets the rule. */
export function stalledSinceSentence(status: { since: string; months: number }): string {
  return `Sin gasto registrado desde ${formatMonthShort(status.since)} (${status.months} meses).`;
}

export function stalledCountText(total: number): string {
  return `${formatInteger(total)} ${total === 1 ? 'proyecto' : 'proyectos'} en la región`;
}
