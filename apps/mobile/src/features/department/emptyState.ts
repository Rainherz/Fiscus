import { levelFilterLabel } from '../government-level/levelPresentation';
import type { LevelFilter } from '../investments/domain/governmentLevel';
import type { StatusFilter } from '../investments/domain/investmentStatus';
import { departmentName } from './departments';
import type { Scope } from './scope';

/**
 * Empty lists say which filters are on and offer shortcuts that relax them: a reader with a
 * remembered "Proyectos cerrados" filter must not read an empty list as "there is nothing".
 */

/**
 * What the empty list is: `paralyzed` (Contraloría report, almost only active projects), `search`
 * (only the scope narrows names) or any other list.
 */
export type EmptyListKind = 'default' | 'paralyzed' | 'search';

export type EmptyShortcutId = 'status' | 'level' | 'scope';

export interface EmptyShortcut {
  id: EmptyShortcutId;
  label: string;
  accessibilityLabel: string;
}

const STATUS_DESCRIPTIONS: Record<StatusFilter, string | null> = {
  ACTIVE: null,
  CLOSED: 'Proyectos cerrados',
  ALL: 'Activos y cerrados',
};

/**
 * "en Arequipa · Gobiernos locales · Proyectos cerrados". Defaults (every level, active projects)
 * are left out; all of Peru is "en todo el Perú". `scope` or `level` null: the list does not follow
 * that global filter (region comparisons, an entity's own level).
 */
export function describeActiveFilters(
  scope: Scope | null,
  level: LevelFilter | null,
  status: StatusFilter,
  extra: readonly string[] = [],
): string {
  const where = scope === null ? null : scope.kind === 'national' ? 'en todo el Perú' : `en ${departmentName(scope.code)}`;
  const levelPart = level === null || level === 'ALL' ? null : levelFilterLabel(level);
  const parts = [where, levelPart, STATUS_DESCRIPTIONS[status], ...extra];
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}

/** "<what> <filters>.": a description led by the scope follows a space, any other a separator. */
export function filteredEmptyMessage(what: string, filters: string): string {
  if (!filters) return `${what}.`;
  return `${what}${filters.startsWith('en ') ? ' ' : ' · '}${filters}.`;
}

const SHORTCUTS: Record<EmptyShortcutId, EmptyShortcut> = {
  status: { id: 'status', label: 'Ver todos los estados', accessibilityLabel: 'Ver proyectos activos y cerrados' },
  level: { id: 'level', label: 'Ver todos los niveles', accessibilityLabel: 'Ver todos los niveles de gobierno' },
  scope: { id: 'scope', label: 'Ver todo el Perú', accessibilityLabel: 'Ver proyectos de todo el Perú' },
};

const MAX_SHORTCUTS = 2;

/**
 * Up to two shortcuts that relax the most restrictive filters, in this order: only closed projects,
 * one level of government, one department. A search only offers the scope (a CUI is found anywhere).
 */
export function emptyShortcuts(input: {
  scope: Scope | null;
  level: LevelFilter | null;
  status: StatusFilter;
  list?: EmptyListKind;
}): EmptyShortcut[] {
  const { scope, level, status, list = 'default' } = input;
  const inDepartment = scope?.kind === 'department';
  const ids: EmptyShortcutId[] =
    list === 'search'
      ? inDepartment
        ? ['scope']
        : []
      : [
          ...(status === 'CLOSED' ? (['status'] as const) : []),
          ...(level !== null && level !== 'ALL' ? (['level'] as const) : []),
          ...(inDepartment ? (['scope'] as const) : []),
        ];
  return ids.slice(0, MAX_SHORTCUTS).map((id) => SHORTCUTS[id]);
}

export const PARALYZED_CLOSED_HINT = 'Las obras paralizadas suelen ser proyectos activos.';
export const SEARCH_EMPTY_HINT = 'Revisa la ortografía o busca por CUI.';

/** A line under the message, only where it adds a fact. */
export function emptyHint(list: EmptyListKind, status: StatusFilter): string | null {
  if (list === 'search') return SEARCH_EMPTY_HINT;
  if (list === 'paralyzed' && status === 'CLOSED') return PARALYZED_CLOSED_HINT;
  return null;
}
