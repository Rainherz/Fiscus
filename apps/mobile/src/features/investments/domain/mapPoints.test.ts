import { sampleRow } from '../adapters/sampleData';
import { mapInvestmentRow } from './mappers';
import {
  MAP_POINTS_MIN_ZOOM,
  MAX_MAP_CELLS,
  MAX_MAP_POINTS,
  PERU_BBOX,
  clusterCellSize,
  computeMapPoints,
  type MapPointsRequest,
} from './mapPoints';

const at = (cui: string, latitude: number, longitude: number, extra: Parameters<typeof sampleRow>[0] | object = {}) =>
  mapInvestmentRow(
    sampleRow({ cui, viable: 1_000_000, updated: 1_500_000, coordinates: { latitude, longitude }, ...extra }),
  );

const national = (zoom: number, extra: Partial<MapPointsRequest> = {}): MapPointsRequest => ({
  bbox: PERU_BBOX,
  zoom,
  level: 'ALL',
  ...extra,
});

describe('clusterCellSize', () => {
  it('is a quarter of a web-mercator tile', () => {
    expect(clusterCellSize(0)).toBe(90);
    expect(clusterCellSize(5)).toBeCloseTo(2.8125);
  });
});

describe('computeMapPoints', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, i) => at(String(1_000_000 + i), -16 - (i % 20) * 0.05, -72 + i * 0.001));

  it('returns projects as points when few are in view, even zoomed out', () => {
    const result = computeMapPoints([at('1', -16.4, -71.5), at('2', -13.5, -72)], national(5));
    expect(result).toEqual({
      kind: 'points',
      points: [
        expect.objectContaining({ cui: '1', latitude: -16.4, longitude: -71.5, costIncrease: 500_000 }),
        expect.objectContaining({ cui: '2' }),
      ],
    });
  });

  it('clusters by grid cell when more than the point limit are in view', () => {
    const result = computeMapPoints(many(MAX_MAP_POINTS + 1), national(5));
    expect(result.kind).toBe('clusters');
    if (result.kind !== 'clusters') return;
    expect(result.clusters.reduce((sum, c) => sum + c.count, 0)).toBe(MAX_MAP_POINTS + 1);
    expect(result.clusters.length).toBeLessThanOrEqual(MAX_MAP_CELLS);
    const [first] = result.clusters;
    expect(first.totalCostIncrease).toBe(first.count * 500_000);
    expect(first.increasedCount).toBe(first.count);
    expect(first.maxCostIncreasePct).toBe(50);
  });

  it('puts the cluster at the centroid of its projects', () => {
    const projects = [...many(MAX_MAP_POINTS), at('a', -10.1, -75.1), at('b', -10.3, -75.3)];
    const result = computeMapPoints(projects, national(5));
    if (result.kind !== 'clusters') throw new Error('expected clusters');
    const pair = result.clusters.find((c) => c.count === 2);
    expect(pair?.latitude).toBeCloseTo(-10.2);
    expect(pair?.longitude).toBeCloseTo(-75.2);
  });

  it('returns at most the point limit from the points zoom, largest increase first', () => {
    const top = at('9', -16, -72, { updated: 9_000_000 });
    const result = computeMapPoints([...many(MAX_MAP_POINTS + 5), top], national(MAP_POINTS_MIN_ZOOM));
    if (result.kind !== 'points') throw new Error('expected points');
    expect(result.points).toHaveLength(MAX_MAP_POINTS);
    expect(result.points[0].cui).toBe('9');
  });

  it('adds only positive valid increases to cluster totals', () => {
    const projects = [
      ...many(MAX_MAP_POINTS),
      at('down', -5.01, -80.01, { updated: 800_000 }),
      at('invalid', -5.02, -80.02, { updated: 10 }),
    ];
    const result = computeMapPoints(projects, national(5));
    if (result.kind !== 'clusters') throw new Error('expected clusters');
    const cell = result.clusters.find((c) => c.count === 2);
    expect(cell).toEqual(
      expect.objectContaining({ totalCostIncrease: 0, increasedCount: 0, maxCostIncreasePct: -20 }),
    );
  });

  it('filters by bounding box, level and department and skips projects without coordinates', () => {
    const projects = [
      at('aqp', -16.4, -71.5, { level: 'GR', departmentCode: 4 }),
      at('cus', -13.5, -72, { level: 'GL', departmentCode: 8 }),
      at('lima', -12, -77, { level: 'GN', departmentCode: null }),
      mapInvestmentRow(sampleRow({ cui: 'none' })),
    ];
    const cuis = (request: MapPointsRequest) => {
      const result = computeMapPoints(projects, request);
      return result.kind === 'points' ? result.points.map((p) => p.cui) : [];
    };
    expect(cuis(national(5))).toEqual(['aqp', 'cus', 'lima']);
    expect(cuis(national(5, { level: 'GL' }))).toEqual(['cus']);
    expect(cuis(national(5, { departmentCode: 4 }))).toEqual(['aqp']);
    expect(cuis(national(8, { bbox: { minLat: -12.5, minLon: -77.5, maxLat: -11.5, maxLon: -76.5 } }))).toEqual([
      'lima',
    ]);
  });
});
