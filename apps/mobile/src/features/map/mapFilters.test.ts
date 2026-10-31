import { MAP_FILTER_OPTIONS, parseMapFilters, serializeMapFilters, toggleMapFilter } from './mapFilters';

describe('parseMapFilters', () => {
  it('reads the comma-separated `f` parameter in a fixed order', () => {
    expect(parseMapFilters('overspent,increase')).toEqual(['increase', 'overspent']);
    expect(parseMapFilters('increase,stalled,overspent')).toEqual(['increase', 'stalled', 'overspent']);
  });

  it('ignores unknown, repeated and empty values', () => {
    expect(parseMapFilters('stalled,,bogus,stalled, increase ')).toEqual(['increase', 'stalled']);
    expect(parseMapFilters('')).toEqual([]);
    expect(parseMapFilters(undefined)).toEqual([]);
  });

  it('reads a repeated parameter (an array) too', () => {
    expect(parseMapFilters(['stalled', 'increase'])).toEqual(['increase', 'stalled']);
  });
});

describe('serializeMapFilters', () => {
  it('writes the filters for the URL, or nothing without filters', () => {
    expect(serializeMapFilters(['overspent', 'increase'])).toBe('increase,overspent');
    expect(serializeMapFilters([])).toBeUndefined();
  });

  it('round-trips', () => {
    expect(parseMapFilters(serializeMapFilters(['stalled', 'overspent']))).toEqual(['stalled', 'overspent']);
  });
});

describe('toggleMapFilter', () => {
  it('adds or removes one filter, keeping the order', () => {
    expect(toggleMapFilter(['overspent'], 'increase')).toEqual(['increase', 'overspent']);
    expect(toggleMapFilter(['increase', 'overspent'], 'increase')).toEqual(['overspent']);
  });
});

describe('MAP_FILTER_OPTIONS', () => {
  it('labels the chips in neutral Spanish', () => {
    expect(MAP_FILTER_OPTIONS.map((o) => [o.key, o.label])).toEqual([
      ['increase', 'Con aumento'],
      ['stalled', 'Sin gasto reciente'],
      ['overspent', 'Gastó más que su costo'],
      ['paralyzed', 'Paralizada (Contraloría)'],
    ]);
  });

  it('reads the paralyzed-works filter from the URL, last', () => {
    expect(parseMapFilters('paralyzed,increase')).toEqual(['increase', 'paralyzed']);
  });
});
