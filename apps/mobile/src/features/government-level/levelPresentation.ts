import type { Tag } from '@/shared/ui/LevelTag';

import type { GovernmentLevel, LevelFilter } from '../investments/domain/governmentLevel';

/** The level filter as the header shows it. */
const FILTER_LABELS: Record<LevelFilter, string> = {
  ALL: 'Todos los niveles',
  GN: 'Gobierno nacional',
  GR: 'Gobiernos regionales',
  GL: 'Gobiernos locales',
};

export function levelFilterLabel(level: LevelFilter): string {
  return FILTER_LABELS[level];
}

/** Short labels of the segmented control in the picker, under "NIVEL DE GOBIERNO". */
export const LEVEL_OPTIONS: readonly { key: LevelFilter; label: string }[] = [
  { key: 'ALL', label: 'Todos' },
  { key: 'GN', label: 'Nacional' },
  { key: 'GR', label: 'Regional' },
  { key: 'GL', label: 'Local' },
];

/** What a level tag (GN, GR, GL) stands for, for screen readers and the detail screen. */
const LEVEL_NAMES: Record<GovernmentLevel, string> = {
  GN: 'Gobierno nacional',
  GR: 'Gobierno regional',
  GL: 'Gobierno local',
};

export function levelName(level: GovernmentLevel): string {
  return LEVEL_NAMES[level];
}

/** The GN/GR/GL tag of a project row, announced by its name. */
export function levelTag(level: GovernmentLevel | null): Tag | undefined {
  return level === null ? undefined : { text: level, label: LEVEL_NAMES[level] };
}

/** Which investments a figure covers: the first sentence of the footnotes. */
export function levelScopeNote(level: LevelFilter): string {
  return level === 'ALL' ? 'Todos los niveles de gobierno.' : `${FILTER_LABELS[level]}.`;
}

/**
 * Footnote of the region comparison (picker, home block, compare screen). Multi-department
 * national projects have no region, so they are not in any region's figures.
 */
export function regionsNote(level: LevelFilter): string {
  const missing = level === 'ALL' || level === 'GN' ? ' No incluye proyectos de varias regiones.' : '';
  return `${levelScopeNote(level)}${missing} Montos en soles corrientes.`;
}
