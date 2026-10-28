import { DEPARTMENTS, departmentName, regionLabel } from './departments';

/** What every screen shows: all of Peru, or one department (region). */
export type Scope = { kind: 'national' } | { kind: 'department'; code: number };

export const NATIONAL: Scope = { kind: 'national' };

export const NATIONAL_LABEL = 'Todo el Perú';

export function department(code: number): Scope {
  return { kind: 'department', code };
}

/** The department filter of repository calls: undefined means all of Peru. */
export function departmentCodeOf(scope: Scope): number | undefined {
  return scope.kind === 'department' ? scope.code : undefined;
}

export function scopeLabel(scope: Scope): string {
  return scope.kind === 'national' ? NATIONAL_LABEL : departmentName(scope.code);
}

/** A detail line led by the region name (or "Varias regiones"), for rows that list all of Peru. */
export function withRegion(departmentCode: number | null, line: string): string {
  return `${regionLabel(departmentCode)} · ${line}`;
}

export function isSameScope(a: Scope, b: Scope): boolean {
  return departmentCodeOf(a) === departmentCodeOf(b);
}

export function serializeScope(scope: Scope): string {
  return JSON.stringify(scope);
}

/** A stored scope, or null when the value is missing or not a known scope. */
export function parseScope(raw: string | null): Scope | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { kind, code } = value as { kind?: unknown; code?: unknown };
  if (kind === 'national') return NATIONAL;
  if (kind === 'department' && typeof code === 'number' && DEPARTMENTS.some((d) => d.code === code)) {
    return department(code);
  }
  return null;
}

/**
 * `ready` turns true once the stored scope was read; `chosen` records a selection made by the
 * reader, which wins over a stored value that arrives later.
 */
export interface ScopeState {
  scope: Scope;
  ready: boolean;
  chosen: boolean;
}

export type ScopeAction = { type: 'hydrated'; stored: Scope | null } | { type: 'selected'; scope: Scope };

export function scopeReducer(state: ScopeState, action: ScopeAction): ScopeState {
  switch (action.type) {
    case 'hydrated':
      if (state.chosen) return { ...state, ready: true };
      return { scope: action.stored ?? NATIONAL, ready: true, chosen: false };
    case 'selected':
      return { scope: action.scope, ready: true, chosen: true };
  }
}
