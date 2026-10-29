import { buildRankingQuery } from '../domain/queries';
import type { CostChangeRow } from '../domain/mappers';
import { createInMemoryInvestmentsRepository } from './inMemoryInvestmentsRepository';
import { sampleRow } from './sampleData';

const PERU = { minLat: -19, minLon: -82, maxLat: 0, maxLon: -68 };

const rows = [
  sampleRow({
    cui: 'active',
    function: 'SALUD',
    viable: 1_000_000,
    updated: 1_500_000,
    progress: 0.5,
    lastAccrualMonth: '2024-01-01',
    entity: 'GOBIERNO REGIONAL AREQUIPA',
    coordinates: { latitude: -16.4, longitude: -71.5 },
  }),
  sampleRow({ cui: 'recent', function: 'SALUD', viable: 1_000_000, updated: 1_100_000, progress: 0.3, lastAccrualMonth: '2026-10-01' }),
  sampleRow({
    cui: 'closed',
    status: 'CERRADO',
    function: 'TRANSPORTE',
    viable: 2_000_000,
    updated: 3_000_000,
    progress: 0.5,
    lastAccrualMonth: '2020-01-01',
    entity: 'GOBIERNO REGIONAL AREQUIPA',
    coordinates: { latitude: -16.41, longitude: -71.51 },
    dataSource: 'open_data_closed',
    closure: { closedAt: '2021-03-01', culminated: false, description: 'No culminada' },
  }),
  sampleRow({ cui: 'other', status: null, function: 'SALUD', viable: 1_000_000, updated: 1_200_000 }),
];

function change(id: number, cui: string): CostChangeRow {
  return {
    id,
    cui,
    change_kind: 'changed',
    observed_at: `2026-11-0${id}T10:00:00Z`,
    source_updated_at: null,
    previous_viable_amount: 1,
    viable_amount: 1,
    previous_updated_cost: 1_000,
    updated_cost: 2_000,
    accrued_total: null,
    updated_cost_delta: 1_000,
  };
}

const repo = createInMemoryInvestmentsRepository({
  rows,
  lastRun: null,
  costChanges: [change(1, 'active'), change(2, 'closed')],
});

describe('in-memory repository with a status filter', () => {
  it('maps the closure facts of a closed row', async () => {
    expect((await repo.findByCui('closed'))?.closure).toMatchObject({ closedAt: '2021-03-01', culminated: false });
    expect((await repo.findByCui('active'))?.closure).toBeNull();
  });

  it('ranks only the projects of the status', async () => {
    const closed = await repo.findMany(buildRankingQuery({ kind: 'cost', status: 'CLOSED', page: 0 }));
    const active = await repo.findMany(buildRankingQuery({ kind: 'cost', status: 'ACTIVE', page: 0 }));
    const all = await repo.findMany(buildRankingQuery({ kind: 'cost', status: 'ALL', page: 0 }));
    expect(closed.map((i) => i.cui)).toEqual(['closed']);
    expect(active.map((i) => i.cui).sort()).toEqual(['active', 'recent']);
    expect(all).toHaveLength(4);
  });

  it('summarizes functions of one status', async () => {
    expect(await repo.functionSummaries(undefined, 'ALL', 'CLOSED')).toEqual([
      expect.objectContaining({ function: 'TRANSPORTE', investmentCount: 1 }),
    ]);
    expect((await repo.functionSummaries(4, 'GR', 'ACTIVE')).map((s) => s.investmentCount)).toEqual([2]);
  });

  it('compares regions over one status (other statuses only under ALL)', async () => {
    const [active] = await repo.getRegionComparison('ALL', 'ACTIVE');
    const [closed] = await repo.getRegionComparison('ALL', 'CLOSED');
    const [all] = await repo.getRegionComparison('ALL', 'ALL');
    expect(active).toMatchObject({ projectCount: 2, stalledCount: 1 });
    expect(closed).toMatchObject({ projectCount: 1, stalledCount: 0 });
    expect(all).toMatchObject({ projectCount: 4, stalledCount: 1 });
  });

  it('ranks entities over one status', async () => {
    const closed = await repo.getEntityComparison({ sort: 'increase-amount', status: 'CLOSED', page: 0 });
    expect(closed).toEqual([expect.objectContaining({ entity: 'GOBIERNO REGIONAL AREQUIPA', projectCount: 1, totalCostIncrease: 1_000_000 })]);
  });

  it('lists recent increases of one status', async () => {
    expect((await repo.getRecentCostIncreases({ status: 'CLOSED', limit: 5 })).map((c) => c.cui)).toEqual(['closed']);
    expect((await repo.getRecentCostIncreases({ status: 'ACTIVE', limit: 5 })).map((c) => c.cui)).toEqual(['active']);
  });

  it('never lists closed projects as stalled', async () => {
    expect(await repo.getStalledInvestments({ status: 'CLOSED', page: 0 })).toEqual([]);
    expect(await repo.countStalledInvestments(undefined, 'ALL', 'CLOSED')).toBe(0);
    expect((await repo.getStalledInvestments({ status: 'ALL', page: 0 })).map((i) => i.cui)).toEqual(['active']);
  });

  it('maps closed points apart and filters the map by status', async () => {
    const all = await repo.getMapPoints({ bbox: PERU, zoom: 14, level: 'ALL', status: 'ALL' });
    expect(all.kind === 'points' && all.points.map((p) => [p.cui, p.closed]).sort()).toEqual([
      ['active', false],
      ['closed', true],
    ]);
    const closed = await repo.getMapList({ bbox: PERU, level: 'ALL', status: 'CLOSED', page: 0 });
    expect(closed.items.map((i) => i.cui)).toEqual(['closed']);
  });
});
