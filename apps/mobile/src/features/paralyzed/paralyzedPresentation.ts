import { withRegion } from '@/features/department/scope';
import type { ParalyzedEdition, ParalyzedInvestment, ParalyzedSummary } from '@/features/investments/domain/paralyzed';
import { formatDate, formatInteger, formatMonth, formatSolesCompact } from '@/shared/format';
import { PARALYZED_DATA_SOURCE_NAME } from '@/shared/ui/DataFooter';

/**
 * Wording of the official list of paralyzed works (Contraloría). It is always attributed and kept
 * apart from "Sin gasto reciente", which is a rule of Fiscus.
 */

/** Detail screen block. */
export const PARALYZED_TITLE = 'PARALIZADA SEGÚN LA CONTRALORÍA';
/** Home block. */
export const PARALYZED_LIST_TITLE = 'PARALIZADAS SEGÚN LA CONTRALORÍA';
export const PARALYZED_ATTRIBUTION = 'Fuente: Contraloría General de la República.';
export const PARALYZED_RULE_NOTE =
  'Proyectos con obras en el informe trimestral de obras paralizadas de la Contraloría, por saldo de obra. ' +
  'Es un dato oficial, distinto de «Sin gasto reciente».';
export const PARALYZED_EMPTY = 'Ningún proyecto de este ámbito figura en el último informe de obras paralizadas.';

const monthIndex = (value: string): number | null => {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
};

/** Whole calendar months from the cut-off month to `now` (Lima has no DST; UTC is close enough for months). */
export function editionAgeMonths(editionCutoff: string, now: Date): number | null {
  const from = monthIndex(editionCutoff);
  if (from === null) return null;
  return now.getUTCFullYear() * 12 + now.getUTCMonth() - from;
}

/**
 * "Corte: junio 2026 (hace 4 meses) · publicado 17/08/2026". The report is quarterly, so its age is
 * shown rather than judged.
 */
export function paralyzedEditionLine(edition: ParalyzedEdition, now?: Date): string {
  const age = now ? editionAgeMonths(edition.editionCutoff, now) : null;
  const ageText = age !== null && age > 0 ? ` (hace ${age} ${age === 1 ? 'mes' : 'meses'})` : '';
  const published = edition.publishedAt ? ` · publicado ${formatDate(edition.publishedAt)}` : '';
  return `Corte: ${formatMonth(edition.editionCutoff)}${ageText}${published}`;
}

/** The causal as the report names it, in sentence case. */
export function paralyzedCausal(label: string | null): string {
  if (!label) return 'Causal no informada';
  const lower = label.trim().toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Physical progress of the obras (0-100): one value, or the range when several obras differ. */
export function paralyzedProgressText(summary: Pick<ParalyzedSummary, 'minPhysicalProgress' | 'maxPhysicalProgress'>): string {
  const { minPhysicalProgress: min, maxPhysicalProgress: max } = summary;
  if (min === null || max === null) return '—';
  const low = formatInteger(min);
  const high = formatInteger(max);
  return low === high ? `${low} %` : `${low}–${high} %`;
}

/** Two factual lines under the project name; listing all of Peru, the first starts with the region. */
export function paralyzedRowDetail(item: ParalyzedInvestment, options: { national?: boolean } = {}): [string, string] {
  const causal = paralyzedCausal(item.mainCausalLabel);
  const obras = item.obraCount > 1 ? ` · ${formatInteger(item.obraCount)} obras` : '';
  return [
    options.national ? withRegion(item.departmentCode, causal) : causal,
    `Avance físico ${paralyzedProgressText(item)} · ${formatSolesCompact(item.totalRemainingWorkBalance)} saldo de obra${obras}`,
  ];
}

export function paralyzedCountText(total: number, options: { national?: boolean } = {}): string {
  const where = options.national ? 'en el país' : 'en la región';
  return `${formatInteger(total)} ${total === 1 ? 'proyecto' : 'proyectos'} ${where}`;
}

/** The footer's source line for this report. */
export function paralyzedSourceName(editionCutoff: string | null): string {
  return editionCutoff
    ? `${PARALYZED_DATA_SOURCE_NAME} (corte ${formatMonth(editionCutoff)})`
    : PARALYZED_DATA_SOURCE_NAME;
}
