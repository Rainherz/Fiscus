import { sampleRow } from '../adapters/sampleData';
import { mapInvestmentRow } from './mappers';
import {
  MAP_POINTS_MIN_ZOOM,
  MAX_MAP_CELLS,
  MAX_MAP_POINTS,
  PERU_BBOX,
  MAP_LIST_PAGE_SIZE,
  clusterCellSize,
  computeMapList,
  computeMapPoints,
  toMapListItem,
  type MapFilter,
  type MapListRequest,
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

describe('map filters', () => {
  // Reference month (latest accrual of the dataset): October 2026.
  const recent = { lastAccrualMonth: '2026-10-01' };
  const projects = [
    at('inc', -16.4, -71.5, { viable: 1_000, updated: 1_900, progress: 0.5, ...recent }),
    at('stl', -16.4, -71.5, { viable: 5_000, updated: 5_000, progress: 0.4, lastAccrualMonth: '2025-02-01' }),
    at('ovr', -16.4, -71.5, { viable: 2_000, updated: 3_000, progress: 1.5, ...recent }),
    at('inc-stl', -13.5, -72, { viable: 1_000, updated: 5_000, progress: 0.2, lastAccrualMonth: '2024-01-01', level: 'GN', departmentCode: 8 }),
    at('invalid', -16.4, -71.5, { viable: 100_000, updated: 10, accrued: 50_000, lastAccrualMonth: '2024-01-01' }),
    at('twelve', -16.4, -71.5, { viable: 5_000, updated: 5_000, progress: 0.5, lastAccrualMonth: '2025-10-01' }),
    at('closed', -16.4, -71.5, { viable: 5_000, updated: 5_000, progress: 0.4, lastAccrualMonth: '2024-01-01', status: 'CERRADO' }),
  ];
  const cuis = (filters: MapFilter[], extra: Partial<MapPointsRequest> = {}) => {
    const result = computeMapPoints(projects, national(14, { filters, ...extra }));
    return result.kind === 'points' ? result.points.map((p) => p.cui).sort() : [];
  };

  it('keeps every project without filters', () => {
    expect(cuis([])).toHaveLength(projects.length);
  });

  it('applies each filter with the rules of the SQL function', () => {
    expect(cuis(['increase'])).toEqual(['inc', 'inc-stl', 'ovr']);
    expect(cuis(['stalled'])).toEqual(['inc-stl', 'stl']);
    expect(cuis(['overspent'])).toEqual(['ovr']);
  });

  it('combines filters with AND, and with level and department', () => {
    expect(cuis(['increase', 'stalled'])).toEqual(['inc-stl']);
    expect(cuis(['increase', 'overspent'])).toEqual(['ovr']);
    expect(cuis(['increase', 'stalled', 'overspent'])).toEqual([]);
    expect(cuis(['increase'], { level: 'GN' })).toEqual(['inc-stl']);
    expect(cuis(['increase'], { departmentCode: 4 })).toEqual(['inc', 'ovr']);
  });

  it('clusters count only the projects that match', () => {
    const many = Array.from({ length: 2 * MAX_MAP_POINTS + 2 }, (_, i) =>
      at(String(1_000_000 + i), -16 - (i % 20) * 0.05, -72 + i * 0.001, i % 2 === 0 ? {} : { updated: 1_000_000 }),
    );
    const result = computeMapPoints(many, national(5, { filters: ['increase'] }));
    expect(result.kind).toBe('clusters');
    if (result.kind !== 'clusters') return;
    expect(result.clusters.reduce((sum, c) => sum + c.count, 0)).toBe(MAX_MAP_POINTS + 1);
    expect(result.clusters.every((c) => c.increasedCount === c.count)).toBe(true);
  });
});

describe('computeMapList', () => {
  const list = (request: Partial<MapListRequest>, rows = listRows) =>
    computeMapList(rows, { bbox: PERU_BBOX, level: 'ALL', page: 0, ...request });
  const listRows = [
    at('small', -16.4, -71.5, { viable: 1_000, updated: 1_900, progress: 0.5, lastAccrualMonth: '2026-10-01' }),
    at('big', -16.4, -71.5, { viable: 1_000, updated: 5_000, progress: 0.2, lastAccrualMonth: '2024-01-01', physicalProgress: 10, entity: 'MTC' }),
    at('flat-b', -16.4, -71.5, { viable: 5_000, updated: 5_000, progress: 0.5, lastAccrualMonth: '2026-10-01' }),
    at('flat-a', -16.4, -71.5, { viable: 5_000, updated: 5_000, progress: 0.5, lastAccrualMonth: '2026-10-01' }),
    at('flat-cheap', -16.4, -71.5, { viable: 2_000, updated: 2_000, progress: 0.5, lastAccrualMonth: '2026-10-01' }),
    at('invalid', -16.4, -71.5, { viable: 100_000, updated: 10, accrued: 50_000 }),
    at('far', -5.2, -80.6, { viable: 1_000, updated: 3_000, progress: 0.5, departmentCode: 20 }),
    mapInvestmentRow(sampleRow({ cui: 'nowhere', viable: 1_000, updated: 9_000 })),
  ];

  it('orders by cost increase (nulls last), then updated cost, then CUI, with the total', () => {
    expect(list({})).toEqual({
      total: 7,
      items: ['big', 'far', 'small', 'flat-a', 'flat-b', 'flat-cheap', 'invalid'].map((cui) => expect.objectContaining({ cui })),
    });
  });

  it('pages by 30 by default and keeps the total', () => {
    const many = Array.from({ length: 65 }, (_, i) => at(String(100 + i), -16, -72));
    expect(list({}, many).items).toHaveLength(MAP_LIST_PAGE_SIZE);
    expect(list({ page: 2 }, many)).toEqual({ total: 65, items: expect.any(Array) });
    expect(list({ page: 2 }, many).items).toHaveLength(5);
    expect(list({ page: 1, pageSize: 2 }).items.map((i) => i.cui)).toEqual(['small', 'flat-a']);
  });

  it('applies the box, scope and filters', () => {
    const arequipa = { minLat: -17, minLon: -72, maxLat: -16, maxLon: -71 };
    expect(list({ bbox: arequipa }).total).toBe(6);
    expect(list({ departmentCode: 20 }).items.map((i) => i.cui)).toEqual(['far']);
    expect(list({ filters: ['stalled'] }).items.map((i) => i.cui)).toEqual(['big']);
  });

  it('returns what the list and the card show', () => {
    expect(list({ filters: ['stalled'] }).items[0]).toEqual({
      cui: 'big',
      name: 'Proyecto big',
      entity: 'MTC',
      status: 'ACTIVO',
      latitude: -16.4,
      longitude: -71.5,
      governmentLevel: 'GR',
      updatedCost: 5_000,
      updatedCostValid: true,
      accruedTotal: 1_000,
      costIncrease: 4_000,
      costIncreasePct: 400,
      executionProgress: 0.2,
      spentAnomaly: false,
      physicalProgress: 10,
      lastAccrualMonth: '2024-01-01',
      stalled: true,
      paralyzed: false,
      closed: false,
    });
  });
});

describe('toMapListItem', () => {
  it('builds the card figures of a project read by CUI, with the stalled rule', () => {
    const investment = at('9', -16.4, -71.5, { viable: 1_000, updated: 5_000, progress: 0.2, lastAccrualMonth: '2024-01-01', physicalProgress: 7 });
    expect(toMapListItem(investment, '2026-10-01')).toEqual(
      expect.objectContaining({ cui: '9', latitude: -16.4, updatedCost: 5_000, physicalProgress: 7, stalled: true }),
    );
    expect(toMapListItem(investment, '2024-06-01')?.stalled).toBe(false);
    expect(toMapListItem(investment, null)?.stalled).toBe(false);
  });

  it('is null without coordinates', () => {
    expect(toMapListItem(mapInvestmentRow(sampleRow({ cui: '1' })), null)).toBeNull();
  });
});
