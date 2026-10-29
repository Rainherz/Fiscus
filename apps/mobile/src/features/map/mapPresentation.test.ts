import type { MapCluster, MapListItem, MapPoint } from '@/features/investments/domain/mapPoints';

import {
  clusterRadius,
  formatClusterCount,
  mapListCountText,
  mapListRow,
  pointCardFacts,
  pointCardFactTerms,
  pointCardFigureTerm,
  pointCardFigure,
  toMapFeatures,
  withSelected,
} from './mapPresentation';

const point: MapPoint = {
  cui: '2088142',
  name: 'Majes Siguas II etapa',
  latitude: -16.35,
  longitude: -72.15,
  governmentLevel: 'GR',
  costIncrease: 3_809_492_486,
  costIncreasePct: 284.6,
  updatedCostValid: true,
};

const cluster: MapCluster = {
  latitude: -16.4,
  longitude: -71.5,
  count: 1234,
  totalCostIncrease: 0,
  maxCostIncreasePct: null,
  increasedCount: 0,
};

describe('formatClusterCount', () => {
  it.each([
    [1, '1'],
    [999, '999'],
    [1_000, '1 mil'],
    [1_234, '1.2 mil'],
    [9_960, '10 mil'],
    [12_345, '12 mil'],
    [127_000, '127 mil'],
    [999_600, '1 M'],
    [1_250_000, '1.3 M'],
  ])('%i → %s', (count, label) => {
    expect(formatClusterCount(count)).toBe(label);
  });
});

describe('clusterRadius', () => {
  it('grows with the logarithm of the count, within limits', () => {
    expect(clusterRadius(1)).toBe(14);
    expect(clusterRadius(10)).toBeGreaterThan(clusterRadius(1));
    expect(clusterRadius(1_000)).toBeGreaterThan(clusterRadius(100));
    expect(clusterRadius(10_000_000)).toBe(34);
  });
});

describe('toMapFeatures', () => {
  it('turns clusters into labeled circles', () => {
    expect(toMapFeatures({ kind: 'clusters', clusters: [cluster] })).toEqual([
      { kind: 'cluster', id: 'c0', latitude: -16.4, longitude: -71.5, label: '1.2 mil', radius: clusterRadius(1234) },
    ]);
  });

  it('marks points with a positive valid increase', () => {
    const flat = { ...point, cui: '1', costIncrease: 0, costIncreasePct: 0 };
    const invalid = { ...point, cui: '2', updatedCostValid: false };
    expect(toMapFeatures({ kind: 'points', points: [point, flat, invalid] })).toEqual([
      { kind: 'point', id: '2088142', latitude: -16.35, longitude: -72.15, increased: true },
      expect.objectContaining({ id: '1', increased: false }),
      expect.objectContaining({ id: '2', increased: false }),
    ]);
  });
});

describe('pointCardFigure', () => {
  it('shows the increase in soles and percent', () => {
    expect(pointCardFigure(point)).toBe('+S/ 3,809 M · +285%');
  });

  it('says when there is no increase', () => {
    expect(pointCardFigure({ ...point, costIncrease: -5_000_000, costIncreasePct: -10 })).toBe('Sin aumento');
  });

  it('says when the cost is not valid in the source', () => {
    expect(pointCardFigure({ ...point, updatedCostValid: false, costIncrease: null, costIncreasePct: null })).toBe(
      'Costo actualizado no válido en la fuente MEF',
    );
  });
});

const item: MapListItem = {
  ...point,
  entity: 'GOBIERNO REGIONAL AREQUIPA',
  status: 'ACTIVO',
  updatedCost: 5_147_912_126,
  accruedTotal: 926_624_183,
  executionProgress: 0.18,
  spentAnomaly: false,
  physicalProgress: null,
  lastAccrualMonth: '2026-10-01',
  stalled: false,
};

describe('withSelected', () => {
  it('adds the selected project when the map does not draw it (clusters, other view)', () => {
    const clusters = toMapFeatures({ kind: 'clusters', clusters: [cluster] });
    expect(withSelected(clusters, point)).toEqual([
      ...clusters,
      { kind: 'point', id: '2088142', latitude: -16.35, longitude: -72.15, increased: true },
    ]);
  });

  it('leaves the features alone when the project is drawn or nothing is selected', () => {
    const points = toMapFeatures({ kind: 'points', points: [point] });
    expect(withSelected(points, point)).toBe(points);
    expect(withSelected(points, null)).toBe(points);
  });
});

describe('mapListCountText', () => {
  it('counts the projects of the view', () => {
    expect(mapListCountText(1)).toBe('1 proyecto en esta zona');
    expect(mapListCountText(1_280)).toBe('1,280 proyectos en esta zona');
    expect(mapListCountText(0)).toBe('0 proyectos en esta zona');
  });
});

describe('mapListRow', () => {
  it('shows the increase as the value and the entity and current cost below', () => {
    expect(mapListRow(item)).toEqual({
      value: '+S/ 3,809 M',
      detail: ['GOBIERNO REGIONAL AREQUIPA', '+285% · costo S/ 5,148 M'],
      summary: 'aumento +S/ 3,809 M, +285%, costo actual S/ 5,148 M',
    });
  });

  it('says when there is no increase or the cost is not valid', () => {
    expect(mapListRow({ ...item, entity: null, costIncrease: 0, costIncreasePct: 0 })).toEqual({
      value: 'Sin aumento',
      detail: ['Costo S/ 5,148 M'],
      summary: 'sin aumento, costo actual S/ 5,148 M',
    });
    expect(mapListRow({ ...item, updatedCostValid: false, costIncrease: null, costIncreasePct: null }).detail).toEqual([
      'GOBIERNO REGIONAL AREQUIPA',
      'Costo actualizado no válido en la fuente MEF',
    ]);
  });
});

describe('pointCardFacts', () => {
  it('lists the current cost and the share spent', () => {
    expect(pointCardFacts(item)).toEqual(['COSTO ACTUAL S/ 5,148 M', 'GASTADO 18 % DEL COSTO']);
  });

  it('adds the physical progress and the stalled line when they apply', () => {
    expect(pointCardFacts({ ...item, physicalProgress: 42, stalled: true, lastAccrualMonth: '2025-02-01' })).toEqual([
      'COSTO ACTUAL S/ 5,148 M',
      'GASTADO 18 % DEL COSTO',
      'AVANCE FÍSICO 42 %',
      'Sin gasto desde feb 2025',
    ]);
  });

  it('leaves out the cost figures when the cost is not valid', () => {
    expect(pointCardFacts({ ...item, updatedCostValid: false, physicalProgress: 5 })).toEqual(['AVANCE FÍSICO 5 %']);
  });
});

describe('pointCardFactTerms', () => {
  it('pairs every fact line with its glossary term', () => {
    expect(
      pointCardFactTerms({ ...item, physicalProgress: 42, stalled: true, lastAccrualMonth: '2025-02-01' }),
    ).toEqual(['costo-actualizado', 'gastado', 'avance-fisico', 'sin-gasto-reciente']);
    expect(pointCardFactTerms({ ...item, updatedCostValid: false, physicalProgress: 5 })).toEqual(['avance-fisico']);
  });
});

describe('pointCardFigureTerm', () => {
  it('explains the increase, or the invalid cost', () => {
    expect(pointCardFigureTerm(point)).toBe('aumento');
    expect(pointCardFigureTerm({ ...point, updatedCostValid: false })).toBe('costo-no-valido');
  });
});
