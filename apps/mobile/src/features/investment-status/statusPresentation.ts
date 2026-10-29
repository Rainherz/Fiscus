import type { StatusFilter } from '../investments/domain/investmentStatus';

/** Labels of the segmented control in the picker, under "ESTADO". */
export const STATUS_OPTIONS: readonly { key: StatusFilter; label: string }[] = [
  { key: 'ACTIVE', label: 'Activos' },
  { key: 'CLOSED', label: 'Cerrados' },
  { key: 'ALL', label: 'Todos' },
];

const FILTER_LABELS: Record<StatusFilter, string> = {
  ACTIVE: 'Proyectos activos',
  CLOSED: 'Proyectos cerrados',
  ALL: 'Activos y cerrados',
};

/** The status filter as the header shows it, under the level. */
export function statusFilterLabel(status: StatusFilter): string {
  return FILTER_LABELS[status];
}

const SCOPE_NOTES: Record<StatusFilter, string> = {
  ACTIVE: 'Solo proyectos activos.',
  CLOSED: 'Solo proyectos cerrados.',
  ALL: 'Proyectos activos y cerrados.',
};

/** Which projects a figure covers, by status: a sentence for the footnotes. */
export function statusScopeNote(status: StatusFilter): string {
  return SCOPE_NOTES[status];
}

/**
 * "Sin gasto reciente" and "Más tiempo en curso" only make sense for projects still running, so
 * they are hidden (with ACTIVE_ONLY_NOTE) when the filter shows only closed projects.
 */
export function isActiveOnlyHidden(status: StatusFilter): boolean {
  return status === 'CLOSED';
}

export const ACTIVE_ONLY_NOTE =
  'Este criterio se aplica solo a proyectos activos. Elige «Activos» o «Todos» en el selector de región para verlo.';
