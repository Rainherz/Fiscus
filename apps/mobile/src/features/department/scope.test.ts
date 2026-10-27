import { regionLabel } from './departments';
import {
  NATIONAL,
  departmentCodeOf,
  department,
  isSameScope,
  withRegion,
  parseScope,
  scopeLabel,
  scopeReducer,
  serializeScope,
  type ScopeState,
} from './scope';

describe('scope', () => {
  it('is national or one department', () => {
    expect(NATIONAL).toEqual({ kind: 'national' });
    expect(department(8)).toEqual({ kind: 'department', code: 8 });
  });

  it('gives the department code to filter by, or undefined for all of Peru', () => {
    expect(departmentCodeOf(NATIONAL)).toBeUndefined();
    expect(departmentCodeOf(department(4))).toBe(4);
  });

  it('is labeled with the accented department name or "Todo el Perú"', () => {
    expect(scopeLabel(NATIONAL)).toBe('Todo el Perú');
    expect(scopeLabel(department(2))).toBe('Áncash');
  });

  it('compares scopes by value', () => {
    expect(isSameScope(NATIONAL, { kind: 'national' })).toBe(true);
    expect(isSameScope(department(4), department(4))).toBe(true);
    expect(isSameScope(department(4), department(8))).toBe(false);
    expect(isSameScope(department(4), NATIONAL)).toBe(false);
  });
});

describe('withRegion', () => {
  it('puts the accented region name before a detail line', () => {
    expect(withRegion(8, 'CUI 123')).toBe('Cusco · CUI 123');
  });

  it('says "Varias regiones" for a national project without department', () => {
    expect(withRegion(null, 'CUI 123')).toBe('Varias regiones · CUI 123');
    expect(regionLabel(null)).toBe('Varias regiones');
    expect(regionLabel(2)).toBe('Áncash');
  });
});

describe('scope serialization', () => {
  it('round-trips both kinds', () => {
    expect(parseScope(serializeScope(NATIONAL))).toEqual(NATIONAL);
    expect(parseScope(serializeScope(department(25)))).toEqual(department(25));
  });

  it('rejects missing, malformed or unknown values', () => {
    expect(parseScope(null)).toBeNull();
    expect(parseScope('')).toBeNull();
    expect(parseScope('not json')).toBeNull();
    expect(parseScope('4')).toBeNull();
    expect(parseScope('{"kind":"department"}')).toBeNull();
    expect(parseScope('{"kind":"department","code":26}')).toBeNull();
    expect(parseScope('{"kind":"department","code":"4"}')).toBeNull();
    expect(parseScope('{"kind":"province","code":4}')).toBeNull();
  });
});

describe('scopeReducer', () => {
  const hydrating: ScopeState = { scope: NATIONAL, ready: false, chosen: false };

  it('takes the stored scope when hydration finishes', () => {
    expect(scopeReducer(hydrating, { type: 'hydrated', stored: department(8) })).toEqual({
      scope: department(8),
      ready: true,
      chosen: false,
    });
  });

  it('falls back to all of Peru when nothing usable was stored', () => {
    expect(scopeReducer(hydrating, { type: 'hydrated', stored: null })).toEqual({
      scope: NATIONAL,
      ready: true,
      chosen: false,
    });
  });

  it('selects a scope', () => {
    const ready: ScopeState = { scope: NATIONAL, ready: true, chosen: false };
    expect(scopeReducer(ready, { type: 'selected', scope: department(4) })).toEqual({
      scope: department(4),
      ready: true,
      chosen: true,
    });
  });

  it('keeps a choice made before hydration finished', () => {
    const chosen = scopeReducer(hydrating, { type: 'selected', scope: department(4) });
    expect(scopeReducer(chosen, { type: 'hydrated', stored: department(8) })).toEqual({
      scope: department(4),
      ready: true,
      chosen: true,
    });
  });
});
