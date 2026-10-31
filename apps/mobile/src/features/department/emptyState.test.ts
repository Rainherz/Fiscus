import {
  describeActiveFilters,
  emptyHint,
  emptyShortcuts,
  filteredEmptyMessage,
  SEARCH_EMPTY_HINT,
  PARALYZED_CLOSED_HINT,
} from './emptyState';
import { NATIONAL, department } from './scope';

const AREQUIPA = department(4);

describe('describeActiveFilters', () => {
  it('names all of Peru and omits the default level and status', () => {
    expect(describeActiveFilters(NATIONAL, 'ALL', 'ACTIVE')).toBe('en todo el Perú');
  });

  it('lists the department, a level and a non-default status', () => {
    expect(describeActiveFilters(AREQUIPA, 'GL', 'CLOSED')).toBe('en Arequipa · Gobiernos locales · Proyectos cerrados');
  });

  it('shows "Activos y cerrados" for every status', () => {
    expect(describeActiveFilters(NATIONAL, 'ALL', 'ALL')).toBe('en todo el Perú · Activos y cerrados');
  });

  it('appends extra filters (map chips) at the end', () => {
    expect(describeActiveFilters(AREQUIPA, 'ALL', 'ACTIVE', ['Con aumento', 'Sin gasto reciente'])).toBe(
      'en Arequipa · Con aumento · Sin gasto reciente',
    );
  });

  it('leaves the scope out when it does not apply (null)', () => {
    expect(describeActiveFilters(null, 'GR', 'CLOSED')).toBe('Gobiernos regionales · Proyectos cerrados');
    expect(describeActiveFilters(null, 'ALL', 'ACTIVE')).toBe('');
  });
});

describe('filteredEmptyMessage', () => {
  it('joins the message and a scope description with a space', () => {
    expect(filteredEmptyMessage('No hay proyectos', 'en Arequipa · Proyectos cerrados')).toBe(
      'No hay proyectos en Arequipa · Proyectos cerrados.',
    );
  });

  it('joins a description without scope with a separator', () => {
    expect(filteredEmptyMessage('Sin datos para Arequipa', 'Gobiernos locales')).toBe(
      'Sin datos para Arequipa · Gobiernos locales.',
    );
  });

  it('ends the message with a period when there is nothing to describe', () => {
    expect(filteredEmptyMessage('Sin datos para Arequipa', '')).toBe('Sin datos para Arequipa.');
  });
});

describe('emptyShortcuts', () => {
  const ids = (input: Parameters<typeof emptyShortcuts>[0]) => emptyShortcuts(input).map((s) => s.id);

  it('offers nothing with the default filters across all of Peru', () => {
    expect(emptyShortcuts({ scope: NATIONAL, level: 'ALL', status: 'ACTIVE' })).toEqual([]);
  });

  it('relaxes the status first when only closed projects are shown', () => {
    const [first] = emptyShortcuts({ scope: AREQUIPA, level: 'ALL', status: 'CLOSED' });
    expect(first).toEqual({
      id: 'status',
      label: 'Ver todos los estados',
      accessibilityLabel: 'Ver proyectos activos y cerrados',
    });
  });

  it('offers at most two shortcuts: status, then level, then scope', () => {
    expect(ids({ scope: AREQUIPA, level: 'GL', status: 'CLOSED' })).toEqual(['status', 'level']);
    expect(ids({ scope: AREQUIPA, level: 'GL', status: 'ACTIVE' })).toEqual(['level', 'scope']);
    expect(ids({ scope: AREQUIPA, level: 'ALL', status: 'ALL' })).toEqual(['scope']);
  });

  it('labels the level and scope shortcuts', () => {
    expect(emptyShortcuts({ scope: AREQUIPA, level: 'GN', status: 'ACTIVE' })).toEqual([
      { id: 'level', label: 'Ver todos los niveles', accessibilityLabel: 'Ver todos los niveles de gobierno' },
      { id: 'scope', label: 'Ver todo el Perú', accessibilityLabel: 'Ver proyectos de todo el Perú' },
    ]);
  });

  it('only offers the scope for a search', () => {
    expect(ids({ scope: AREQUIPA, level: 'GL', status: 'CLOSED', list: 'search' })).toEqual(['scope']);
    expect(ids({ scope: NATIONAL, level: 'GL', status: 'CLOSED', list: 'search' })).toEqual([]);
  });

  it('never offers the scope when it does not apply (null)', () => {
    expect(ids({ scope: null, level: 'GL', status: 'ACTIVE' })).toEqual(['level']);
  });
});

describe('emptyHint', () => {
  it('reminds that paralyzed works are usually active when only closed ones are shown', () => {
    expect(emptyHint('paralyzed', 'CLOSED')).toBe(PARALYZED_CLOSED_HINT);
    expect(PARALYZED_CLOSED_HINT).toBe('Las obras paralizadas suelen ser proyectos activos.');
    expect(emptyHint('paralyzed', 'ACTIVE')).toBeNull();
  });

  it('suggests checking the spelling of a search', () => {
    expect(emptyHint('search', 'ACTIVE')).toBe(SEARCH_EMPTY_HINT);
    expect(SEARCH_EMPTY_HINT).toBe('Revisa la ortografía o busca por CUI.');
  });

  it('has no hint for other lists', () => {
    expect(emptyHint('default', 'CLOSED')).toBeNull();
  });
});
