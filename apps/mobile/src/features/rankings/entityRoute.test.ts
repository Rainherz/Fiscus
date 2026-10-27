import { entityHref, parseEntityParams } from './entityRoute';

describe('entity route', () => {
  it('links to the drill-down with the entity name and its level', () => {
    expect(entityHref({ entity: 'MUNICIPALIDAD DISTRITAL DE CAYMA', governmentLevel: 'GL' })).toEqual({
      pathname: '/entity',
      params: { name: 'MUNICIPALIDAD DISTRITAL DE CAYMA', level: 'GL' },
    });
    expect(entityHref({ entity: 'X', governmentLevel: null })).toEqual({ pathname: '/entity', params: { name: 'X' } });
  });

  it('reads the entity, its level (every level when unknown) and the tab from the route', () => {
    expect(parseEntityParams({ name: 'MTC', level: 'GN', tab: 'stalled' })).toEqual({
      entity: 'MTC',
      level: 'GN',
      tab: 'stalled',
    });
    expect(parseEntityParams({ name: 'MTC', level: 'ZZ', tab: 'entities' })).toEqual({
      entity: 'MTC',
      level: 'ALL',
      tab: 'increase-amount',
    });
    expect(parseEntityParams({})).toBeNull();
  });
});
