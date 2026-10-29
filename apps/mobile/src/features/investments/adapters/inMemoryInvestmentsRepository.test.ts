import type { CostChangeRow } from '../domain/mappers';
import { buildFunctionQuery, buildRankingQuery, buildSearchQuery } from '../domain/queries';
import { createInMemoryInvestmentsRepository } from './inMemoryInvestmentsRepository';
import { sampleRow } from './sampleData';

const rows = [
  sampleRow({ cui: '1', name: 'Hospital Norte', function: 'SALUD', viable: 100_000_000, updated: 150_000_000, progress: 0.5, viabilityAt: '2015-01-01' }),
  sampleRow({ cui: '2', name: 'Carretera Sur', function: 'TRANSPORTE', viable: 200_000_000, updated: 500_000_000, progress: 0.2, viabilityAt: '2010-01-01' }),
  sampleRow({ cui: '3', name: 'Posta pequeña', function: 'SALUD', viable: 100_000, updated: 900_000, progress: 1, viabilityAt: '2020-01-01' }),
  sampleRow({ cui: '4', name: 'Puente Lima', function: 'TRANSPORTE', viable: 50_000_000, updated: 40_000_000, progress: 0.9, viabilityAt: '2012-01-01', departmentCode: 15 }),
  sampleRow({ cui: '5', name: 'Sin función', function: null, viable: 10_000_000, updated: null, progress: null, viabilityAt: null }),
  sampleRow({ cui: '6', name: 'Costo de relleno', function: 'SALUD', viable: 166_262_211, updated: 10, accrued: 5_000_000, viabilityAt: '2009-01-01' }),
];

const repo = createInMemoryInvestmentsRepository({
  rows,
  lastRun: { startedAt: '2026-10-26T05:00:00Z', finishedAt: '2026-10-26T05:30:00Z' },
});

const cuis = (items: { cui: string }[]) => items.map((i) => i.cui);

describe('in-memory investments repository', () => {
  it('derives cost increase metrics like the database', async () => {
    const [carretera] = await repo.findMany(buildSearchQuery('2', 4)!);
    expect(carretera.costIncrease).toBe(300_000_000);
    expect(carretera.costIncreasePct).toBe(150);
    expect(carretera.accruedTotal).toBe(100_000_000);
    expect(carretera.executionProgress).toBeCloseTo(0.2);
  });

  it('derives null metrics and an invalid flag for placeholder costs, like the database', async () => {
    const placeholder = await repo.findByCui('6');
    expect(placeholder?.updatedCost).toBe(10);
    expect(placeholder?.updatedCostValid).toBe(false);
    expect(placeholder?.accruedTotal).toBe(5_000_000);
    expect(placeholder?.costIncrease).toBeNull();
    expect(placeholder?.costIncreasePct).toBeNull();
    expect(placeholder?.executionProgress).toBeNull();
    expect((await repo.findByCui('5'))?.updatedCostValid).toBe(false);
    expect((await repo.findByCui('1'))?.updatedCostValid).toBe(true);
  });

  it('keeps invalid source costs out of the cost ranking', async () => {
    const items = await repo.findMany(buildRankingQuery({ kind: 'cost', departmentCode: 4, page: 0 }));
    expect(cuis(items)).toEqual(['2', '1', '3']);
  });

  it('applies the increase ranking within the department', async () => {
    const items = await repo.findMany(buildRankingQuery({ kind: 'increase-amount', departmentCode: 4, page: 0 }));
    expect(cuis(items)).toEqual(['2', '1', '3']);
  });

  it('excludes tiny bases from the percentage ranking', async () => {
    const items = await repo.findMany(buildRankingQuery({ kind: 'increase-pct', departmentCode: 4, page: 0 }));
    expect(cuis(items)).toEqual(['2', '1']);
  });

  it('pages results', async () => {
    const items = await repo.findMany(buildRankingQuery({ kind: 'increase-amount', departmentCode: 4, page: 1, pageSize: 2 }));
    expect(cuis(items)).toEqual(['3']);
  });

  it('orders by oldest viability for the duration ranking', async () => {
    const items = await repo.findMany(buildRankingQuery({ kind: 'duration', departmentCode: 4, page: 0 }));
    expect(cuis(items)).toEqual(['6', '2', '1', '3']);
  });

  it('searches names case-insensitively', async () => {
    expect(cuis(await repo.findMany(buildSearchQuery('HOSPITAL', 4)!))).toEqual(['1']);
    expect(cuis(await repo.findMany(buildSearchQuery('puente', 4)!))).toEqual([]);
  });

  it('filters by function, including missing functions', async () => {
    expect(cuis(await repo.findMany(buildFunctionQuery({ departmentCode: 4, fn: 'SALUD', page: 0 })))).toEqual(['1', '3', '6']);
    expect(cuis(await repo.findMany(buildFunctionQuery({ departmentCode: 4, fn: null, page: 0 })))).toEqual(['5']);
  });

  it('groups and filters by the canonical function, merging the old classification', async () => {
    const crosswalk = createInMemoryInvestmentsRepository({
      rows: [
        sampleRow({ cui: 'old', function: 'SALUD Y SANEAMIENTO', division: 'SANEAMIENTO', updated: 3_000_000 }),
        sampleRow({ cui: 'new', function: 'SANEAMIENTO', division: 'SANEAMIENTO', updated: 2_000_000 }),
        sampleRow({ cui: 'health', function: 'SALUD Y SANEAMIENTO', division: 'SALUD INDIVIDUAL', updated: 1_000_000 }),
      ],
      lastRun: null,
    });
    expect((await crosswalk.functionSummaries(4)).map((s) => [s.function, s.investmentCount])).toEqual([
      ['SANEAMIENTO', 2],
      ['SALUD', 1],
    ]);
    expect(cuis(await crosswalk.findMany(buildFunctionQuery({ departmentCode: 4, fn: 'SANEAMIENTO', page: 0 })))).toEqual([
      'old',
      'new',
    ]);
    expect((await crosswalk.findByCui('old'))?.function).toBe('SALUD Y SANEAMIENTO');
  });

  it('finds by CUI', async () => {
    expect((await repo.findByCui('4'))?.name).toBe('Puente Lima');
    expect(await repo.findByCui('999')).toBeNull();
  });

  it('aggregates functions for a department, largest cost first', async () => {
    expect(await repo.functionSummaries(4)).toEqual([
      { function: 'TRANSPORTE', investmentCount: 1, totalUpdatedCost: 500_000_000, totalCostIncrease: 300_000_000 },
      { function: 'SALUD', investmentCount: 3, totalUpdatedCost: 150_900_010, totalCostIncrease: 50_800_000 },
      { function: null, investmentCount: 1, totalUpdatedCost: null, totalCostIncrease: null },
    ]);
  });

  it('aggregates functions for all of Peru without a department', async () => {
    const summaries = await repo.functionSummaries(undefined);
    expect(summaries[0]).toEqual({
      function: 'TRANSPORTE',
      investmentCount: 2,
      totalUpdatedCost: 540_000_000,
      totalCostIncrease: 290_000_000,
    });
    expect(summaries.map((s) => s.function)).toEqual(['TRANSPORTE', 'SALUD', null]);
  });

  it('ranks, searches and lists functions in all of Peru without a department', async () => {
    expect(cuis(await repo.findMany(buildRankingQuery({ kind: 'cost', page: 0 })))).toEqual(['2', '1', '4', '3']);
    expect(cuis(await repo.findMany(buildSearchQuery('puente', undefined)!))).toEqual(['4']);
    expect(cuis(await repo.findMany(buildFunctionQuery({ fn: 'TRANSPORTE', page: 0 })))).toEqual(['2', '4']);
  });

  it('returns the last ingest run', async () => {
    expect((await repo.lastIngestRun())?.finishedAt).toBe('2026-10-26T05:30:00Z');
  });
});

describe('in-memory cost history', () => {
  const change = (input: Partial<CostChangeRow> & Pick<CostChangeRow, 'id' | 'cui' | 'observed_at'>): CostChangeRow => ({
    change_kind: 'changed',
    source_updated_at: null,
    previous_viable_amount: null,
    viable_amount: null,
    previous_updated_cost: null,
    updated_cost: null,
    accrued_total: null,
    updated_cost_delta: null,
    ...input,
  });

  const historyRepo = createInMemoryInvestmentsRepository({
    rows,
    lastRun: null,
    costChanges: [
      change({ id: 3, cui: '1', observed_at: '2026-11-10T10:00:00Z', updated_cost: 160, previous_updated_cost: 150, updated_cost_delta: 10 }),
      change({ id: 1, cui: '1', observed_at: '2026-10-27T10:00:00Z', change_kind: 'baseline', updated_cost: 150 }),
      change({ id: 2, cui: '2', observed_at: '2026-11-03T10:00:00Z', updated_cost_delta: 40 }),
      change({ id: 4, cui: '2', observed_at: '2026-11-12T10:00:00Z', updated_cost_delta: -2 }),
      change({ id: 5, cui: '4', observed_at: '2026-11-12T10:00:00Z', updated_cost_delta: 99 }),
      change({ id: 6, cui: '3', observed_at: '2026-11-12T10:00:00Z', change_kind: 'first_seen', updated_cost_delta: null }),
    ],
  });

  it('returns the history of one investment, oldest first', async () => {
    expect((await historyRepo.getCostHistory('1')).map((c) => c.id)).toEqual([1, 3]);
    expect(await historyRepo.getCostHistory('999')).toEqual([]);
  });

  it('returns increases in the department, newest first, with the investment name', async () => {
    const increases = await historyRepo.getRecentCostIncreases({ departmentCode: 4, limit: 5 });
    expect(increases.map((c) => [c.id, c.name])).toEqual([
      [3, 'Hospital Norte'],
      [2, 'Carretera Sur'],
    ]);
  });

  it('returns increases in all of Peru with the department of each investment', async () => {
    const increases = await historyRepo.getRecentCostIncreases({ limit: 5 });
    expect(increases.map((c) => [c.id, c.name, c.departmentCode])).toEqual([
      [5, 'Puente Lima', 15],
      [3, 'Hospital Norte', 4],
      [2, 'Carretera Sur', 4],
    ]);
  });

  it('limits the number of increases', async () => {
    const increases = await historyRepo.getRecentCostIncreases({ departmentCode: 4, limit: 1 });
    expect(increases.map((c) => c.id)).toEqual([3]);
  });

  it('has no history when seeded without cost changes', async () => {
    expect(await repo.getCostHistory('1')).toEqual([]);
    expect(await repo.getRecentCostIncreases({ departmentCode: 4, limit: 5 })).toEqual([]);
  });
});

describe('in-memory stalled investments', () => {
  const stalledRows = [
    // Sets the reference month: the latest accrual in the whole dataset, in another department.
    sampleRow({ cui: 'ref', updated: 10_000_000, progress: 0.5, lastAccrualMonth: '2026-10-01', departmentCode: 15 }),
    sampleRow({ cui: 's1', updated: 297_000_000, progress: 0.32, lastAccrualMonth: '2025-04-01' }),
    sampleRow({ cui: 's2', updated: 123_000_000, progress: 0.07, lastAccrualMonth: '2022-10-01' }),
    sampleRow({ cui: 's3', updated: 500_000_000, progress: 0.9, lastAccrualMonth: '2025-09-01' }),
    // Exactly 12 months before the reference month: not included.
    sampleRow({ cui: 'm12', updated: 900_000_000, progress: 0.5, lastAccrualMonth: '2025-10-01' }),
    sampleRow({ cui: 'low', updated: 900_000_000, progress: 0.04, lastAccrualMonth: '2024-01-01' }),
    sampleRow({ cui: 'high', updated: 900_000_000, progress: 0.96, lastAccrualMonth: '2024-01-01' }),
    sampleRow({ cui: 'closed', updated: 900_000_000, progress: 0.5, lastAccrualMonth: '2024-01-01', status: 'CERRADO' }),
    sampleRow({ cui: 'invalid', viable: 166_262_211, updated: 10, accrued: 5, lastAccrualMonth: '2024-01-01' }),
    sampleRow({ cui: 'other', updated: 900_000_000, progress: 0.5, lastAccrualMonth: '2024-01-01', departmentCode: 15 }),
  ];
  const stalledRepo = createInMemoryInvestmentsRepository({ rows: stalledRows, lastRun: null });

  it('applies the rule against the latest accrual month of the dataset', async () => {
    expect(await stalledRepo.getAccrualReferenceMonth()).toBe('2026-10-01');
    const items = await stalledRepo.getStalledInvestments({ departmentCode: 4, page: 0 });
    expect(cuis(items)).toEqual(['s1', 's2', 's3']);
  });

  it('orders by the amount not yet spent and adds the months without accrual', async () => {
    const [first, second, third] = await stalledRepo.getStalledInvestments({ departmentCode: 4, page: 0 });
    expect(first).toMatchObject({ cui: 's1', monthsWithoutAccrual: 18 });
    expect(first.pendingAmount).toBeCloseTo(201_960_000, 0);
    expect(second).toMatchObject({ cui: 's2', monthsWithoutAccrual: 48 });
    expect(third).toMatchObject({ cui: 's3', monthsWithoutAccrual: 13 });
  });

  it('pages and counts within the department', async () => {
    expect(cuis(await stalledRepo.getStalledInvestments({ departmentCode: 4, page: 1, pageSize: 2 }))).toEqual(['s3']);
    expect(await stalledRepo.countStalledInvestments(4)).toBe(3);
    expect(await stalledRepo.countStalledInvestments(15)).toBe(1);
  });

  it('lists and counts all of Peru without a department', async () => {
    expect(cuis(await stalledRepo.getStalledInvestments({ page: 0 }))).toEqual(['other', 's1', 's2', 's3']);
    expect(await stalledRepo.countStalledInvestments(undefined)).toBe(4);
  });

  it('has no reference month and no rows without accrual months', async () => {
    expect(await repo.getAccrualReferenceMonth()).toBeNull();
    expect(await repo.getStalledInvestments({ departmentCode: 4, page: 0 })).toEqual([]);
    expect(await repo.countStalledInvestments(4)).toBe(0);
  });
});

describe('in-memory region comparison', () => {
  const regionRows = [
    sampleRow({ cui: 'r1', viable: 1_000_000, updated: 1_500_000, progress: 0.5, lastAccrualMonth: '2026-10-01', departmentCode: 8, departmentName: 'CUSCO' }),
    sampleRow({ cui: 'r2', viable: 2_000_000, updated: 1_800_000, accrued: 2_000_000, lastAccrualMonth: '2026-10-01', departmentCode: 8, departmentName: 'CUSCO' }),
    sampleRow({ cui: 'r3', viable: 1_000_000, updated: 10, departmentCode: 8, departmentName: 'CUSCO' }),
    sampleRow({ cui: 'r4', viable: 500_000, updated: 1_000_000, progress: 0.3, lastAccrualMonth: '2024-01-01' }),
  ];
  const regionRepo = createInMemoryInvestmentsRepository({ rows: regionRows, lastRun: null });

  it('aggregates every department like the region_comparison view', async () => {
    const [arequipa, cusco] = await regionRepo.getRegionComparison();
    expect(arequipa).toMatchObject({ departmentCode: 4, projectCount: 1, stalledCount: 1, stalledPendingAmount: 700_000 });
    expect(cusco).toMatchObject({
      departmentCode: 8,
      departmentName: 'CUSCO',
      projectCount: 3,
      validCostCount: 2,
      totalCostIncrease: 500_000,
      projectsWithIncrease: 1,
      costIncreasePct: 50,
      overspentCount: 1,
      stalledCount: 0,
    });
  });
});

describe('in-memory government levels', () => {
  const levelRows = [
    sampleRow({ cui: 'gr', level: 'GR', entity: 'GR AREQUIPA', function: 'SALUD', viable: 1_000_000, updated: 1_200_000, progress: 0.5, lastAccrualMonth: '2026-09-01' }),
    sampleRow({ cui: 'gn', level: 'GN', entity: 'MTC', function: 'TRANSPORTE', viable: 1_000_000, updated: 2_000_000, progress: 0.3, lastAccrualMonth: '2024-01-01' }),
    sampleRow({ cui: 'gn-multi', level: 'GN', entity: 'MTC', function: 'TRANSPORTE', viable: 5_000_000, updated: 9_000_000, progress: 0.4, lastAccrualMonth: '2024-02-01', departmentCode: null, departmentName: null }),
    sampleRow({ cui: 'gl', level: 'GL', entity: 'MUNI CUSCO', function: 'SALUD', viable: 1_000_000, updated: 1_100_000, progress: 0.2, lastAccrualMonth: '2026-10-01', departmentCode: 8 }),
  ];
  const changes: CostChangeRow[] = levelRows.map((row, index) => ({
    id: index + 1,
    cui: row.cui,
    change_kind: 'changed',
    observed_at: `2026-11-0${index + 1}T10:00:00Z`,
    source_updated_at: null,
    previous_viable_amount: row.viable_amount,
    viable_amount: row.viable_amount,
    previous_updated_cost: 1,
    updated_cost: row.updated_cost,
    accrued_total: row.accrued_total,
    updated_cost_delta: Number(row.updated_cost) - 1,
  }));
  const levels = createInMemoryInvestmentsRepository({ rows: levelRows, lastRun: null, costChanges: changes });

  it('ranks one level or every level, and keeps multi-department projects nationwide only', async () => {
    expect(cuis(await levels.findMany(buildRankingQuery({ kind: 'increase-amount', level: 'GN', page: 0 })))).toEqual([
      'gn-multi',
      'gn',
    ]);
    expect(cuis(await levels.findMany(buildRankingQuery({ kind: 'increase-amount', page: 0 })))).toHaveLength(4);
    expect(cuis(await levels.findMany(buildRankingQuery({ kind: 'increase-amount', departmentCode: 4, page: 0 })))).toEqual([
      'gn',
      'gr',
    ]);
  });

  it('aggregates functions of one level', async () => {
    const summaries = await levels.functionSummaries(undefined, 'GL');
    expect(summaries).toEqual([expect.objectContaining({ function: 'SALUD', investmentCount: 1 })]);
  });

  it('lists recent increases of one level with the level of each investment', async () => {
    const increases = await levels.getRecentCostIncreases({ level: 'GN', limit: 5 });
    expect(increases.map((i) => [i.cui, i.governmentLevel])).toEqual([
      ['gn-multi', 'GN'],
      ['gn', 'GN'],
    ]);
  });

  it('lists and counts stalled projects by level, against the reference month of every level', async () => {
    expect(await levels.getAccrualReferenceMonth()).toBe('2026-10-01');
    expect(cuis(await levels.getStalledInvestments({ level: 'GN', page: 0 }))).toEqual(['gn-multi', 'gn']);
    expect(await levels.countStalledInvestments(undefined, 'GR')).toBe(0);
    expect(await levels.countStalledInvestments(4, 'ALL')).toBe(1);
    expect(cuis(await levels.getStalledInvestments({ level: 'GN', entity: 'MTC', departmentCode: 4, page: 0 }))).toEqual(['gn']);
  });

  it('compares the departments of one level, leaving out projects without department', async () => {
    const all = await levels.getRegionComparison('ALL');
    expect(all.map((r) => [r.departmentCode, r.projectCount])).toEqual([
      [4, 2],
      [8, 1],
    ]);
    expect((await levels.getRegionComparison('GL')).map((r) => r.departmentCode)).toEqual([8]);
  });

  it('ranks and pages entities in the scope', async () => {
    const national = await levels.getEntityComparison({ sort: 'increase-amount', page: 0 });
    expect(national.map((e) => [e.entity, e.totalCostIncrease])).toEqual([
      ['MTC', 5_000_000],
      ['GR AREQUIPA', 200_000],
      ['MUNI CUSCO', 100_000],
    ]);
    expect(national[0].departmentCode).toBeNull();
    const arequipa = await levels.getEntityComparison({ sort: 'increase-amount', departmentCode: 4, page: 0 });
    expect(arequipa.map((e) => [e.entity, e.totalCostIncrease, e.departmentCode])).toEqual([
      ['MTC', 1_000_000, 4],
      ['GR AREQUIPA', 200_000, 4],
    ]);
    expect((await levels.getEntityComparison({ sort: 'stalled', level: 'GN', page: 0 })).map((e) => e.stalledCount)).toEqual([2]);
    expect(await levels.getEntityComparison({ sort: 'overspent', page: 0 })).toEqual([]);
    expect(await levels.getEntityComparison({ sort: 'increase-amount', page: 1, pageSize: 2 })).toHaveLength(1);
  });

  it('returns the map points of the rows with coordinates in the scope', async () => {
    const located = createInMemoryInvestmentsRepository({
      rows: [
        sampleRow({ cui: '1', viable: 100, updated: 2_000, coordinates: { latitude: -16.4, longitude: -71.5 } }),
        sampleRow({ cui: '2', level: 'GL', departmentCode: 8, coordinates: { latitude: -13.5, longitude: -72 } }),
        sampleRow({ cui: '3' }),
      ],
      lastRun: null,
    });
    const bbox = { minLat: -19, minLon: -82, maxLat: 0, maxLon: -68 };

    const all = await located.getMapPoints({ bbox, zoom: 5, level: 'ALL' });
    const arequipa = await located.getMapPoints({ bbox, zoom: 5, level: 'ALL', departmentCode: 4 });

    expect(all.kind === 'points' && all.points.map((p) => p.cui)).toEqual(['1', '2']);
    expect(arequipa).toEqual({
      kind: 'points',
      points: [expect.objectContaining({ cui: '1', latitude: -16.4, longitude: -71.5, costIncrease: 1_900 })],
    });
  });

  it('filters the map and lists the projects in view like map_list', async () => {
    const located = createInMemoryInvestmentsRepository({
      rows: [
        sampleRow({ cui: '1', viable: 100, updated: 2_000, progress: 0.5, lastAccrualMonth: '2026-10-01', coordinates: { latitude: -16.4, longitude: -71.5 } }),
        sampleRow({ cui: '2', viable: 5_000, updated: 5_000, progress: 0.4, lastAccrualMonth: '2025-01-01', coordinates: { latitude: -16.3, longitude: -71.6 } }),
        sampleRow({ cui: '3', viable: 100, updated: 9_000 }),
      ],
      lastRun: null,
    });
    const bbox = { minLat: -19, minLon: -82, maxLat: 0, maxLon: -68 };

    const stalled = await located.getMapPoints({ bbox, zoom: 14, level: 'ALL', filters: ['stalled'] });
    const list = await located.getMapList({ bbox, level: 'ALL', page: 0 });

    expect(stalled.kind === 'points' && stalled.points.map((p) => p.cui)).toEqual(['2']);
    expect(list.total).toBe(2);
    expect(list.items.map((i) => [i.cui, i.stalled])).toEqual([
      ['1', false],
      ['2', true],
    ]);
  });
});
