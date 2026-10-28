import type { MapCluster, MapPoint } from '@/features/investments/domain/mapPoints';

import { clusterRadius, formatClusterCount, pointCardFigure, toMapFeatures } from './mapPresentation';

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
    expect(pointCardFigure({ ...point, costIncrease: -5_000_000, costIncreasePct: -10 })).toBe('Sin aumento de costo');
  });

  it('says when the cost is not valid in the source', () => {
    expect(pointCardFigure({ ...point, updatedCostValid: false, costIncrease: null, costIncreasePct: null })).toBe(
      'Costo actualizado no válido en la fuente MEF',
    );
  });
});
