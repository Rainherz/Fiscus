import type { SupabaseClient } from '@supabase/supabase-js';

import {
  COST_CHANGE_COLUMNS,
  ENTITY_COMPARISON_COLUMNS,
  REGION_COMPARISON_COLUMNS,
  STALLED_INVESTMENT_COLUMNS,
} from '../domain/mappers';
import { buildRankingQuery, buildSearchQuery, buildFunctionQuery } from '../domain/queries';
import { createSupabaseInvestmentsRepository } from './supabaseInvestmentsRepository';
import { sampleRow } from './sampleData';

type Call = [string, ...unknown[]];

/** Chainable PostgREST builder fake that records every call and resolves to `result`. */
function fakeClient(result: { data: unknown; error: { message: string } | null; count?: number | null }) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'gt', 'gte', 'ilike', 'not', 'is', 'order', 'range', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.maybeSingle = () => {
    calls.push(['maybeSingle']);
    return Promise.resolve(result);
  };
  builder.then = (resolve: (value: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  const client = {
    from: (table: string) => {
      calls.push(['from', table]);
      return builder;
    },
    rpc: (fn: string, args: unknown) => {
      calls.push(['rpc', fn, args]);
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('supabase investments repository', () => {
  it('translates a ranking query into PostgREST calls with nulls last', async () => {
    const { client, calls } = fakeClient({ data: [sampleRow({ cui: '1' })], error: null });
    const repo = createSupabaseInvestmentsRepository(client);

    const items = await repo.findMany(buildRankingQuery({ kind: 'cost', departmentCode: 4, page: 1 }));

    expect(items.map((i) => i.cui)).toEqual(['1']);
    expect(calls).toEqual([
      ['from', 'investments'],
      ['select', expect.stringContaining('cost_increase_pct')],
      ['eq', 'department_code', 4],
      ['eq', 'updated_cost_valid', true],
      ['order', 'updated_cost', { ascending: false, nullsFirst: false }],
      ['order', 'cui', { ascending: true, nullsFirst: false }],
      ['range', 30, 59],
    ]);
  });

  it('translates comparison, ilike and null filters', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    const repo = createSupabaseInvestmentsRepository(client);

    await repo.findMany(buildRankingQuery({ kind: 'increase-pct', departmentCode: 4, page: 0 }));
    await repo.findMany(buildSearchQuery('obra', 4)!);
    await repo.findMany(buildFunctionQuery({ departmentCode: 4, fn: null, page: 0 }));

    expect(calls).toContainEqual(['gte', 'viable_amount', 1_000_000]);
    expect(calls).toContainEqual(['gt', 'cost_increase_pct', 0]);
    expect(calls).toContainEqual(['ilike', 'name', '%obra%']);
    expect(calls).toContainEqual(['is', 'function', null]);
  });

  it('throws when Supabase returns an error', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } });
    const repo = createSupabaseInvestmentsRepository(client);
    await expect(repo.findByCui('1')).rejects.toThrow('boom');
  });

  it('reads function summaries for a department and every level from the per-department view', async () => {
    const { client, calls } = fakeClient({
      data: [{ department_code: 4, function: 'SALUD', investment_count: 3, total_updated_cost: '10', total_cost_increase: '2' }],
      error: null,
    });
    const repo = createSupabaseInvestmentsRepository(client);

    expect(await repo.functionSummaries(4)).toEqual([
      { function: 'SALUD', investmentCount: 3, totalUpdatedCost: 10, totalCostIncrease: 2 },
    ]);
    expect(calls).toEqual([
      ['from', 'department_function_summary_by_level'],
      ['select', '*'],
      ['eq', 'government_level', 'ALL'],
      ['eq', 'department_code', 4],
      ['order', 'total_updated_cost', { ascending: false, nullsFirst: false }],
    ]);
  });

  it('reads function summaries of one level', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await createSupabaseInvestmentsRepository(client).functionSummaries(undefined, 'GN');
    expect(calls.slice(0, 3)).toEqual([
      ['from', 'function_summary_by_level'],
      ['select', '*'],
      ['eq', 'government_level', 'GN'],
    ]);
  });

  it('reads function summaries for all of Peru from the national view', async () => {
    const { client, calls } = fakeClient({
      data: [{ function: 'SALUD', investment_count: 30, total_updated_cost: '100', total_cost_increase: null }],
      error: null,
    });
    const repo = createSupabaseInvestmentsRepository(client);

    expect(await repo.functionSummaries(undefined)).toEqual([
      { function: 'SALUD', investmentCount: 30, totalUpdatedCost: 100, totalCostIncrease: null },
    ]);
    expect(calls).toEqual([
      ['from', 'function_summary_by_level'],
      ['select', '*'],
      ['eq', 'government_level', 'ALL'],
      ['order', 'total_updated_cost', { ascending: false, nullsFirst: false }],
    ]);
  });

  it('pages a national ranking without a department filter', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await createSupabaseInvestmentsRepository(client).findMany(
      buildRankingQuery({ kind: 'increase-amount', page: 0, pageSize: 6 }),
    );
    expect(calls.some(([method, column]) => method === 'eq' && column === 'department_code')).toBe(false);
    expect(calls).toContainEqual(['range', 0, 5]);
  });

  it('reads the most recent ingest run', async () => {
    const { client, calls } = fakeClient({
      data: { started_at: 'a', finished_at: 'b' },
      error: null,
    });
    const repo = createSupabaseInvestmentsRepository(client);

    expect(await repo.lastIngestRun()).toEqual({ startedAt: 'a', finishedAt: 'b' });
    expect(calls).toContainEqual(['order', 'finished_at', { ascending: false }]);
    expect(calls).toContainEqual(['limit', 1]);
  });

  it('reads data_freshness', async () => {
    const { client, calls } = fakeClient({
      data: [
        { source: 'ssi', last_success_at: '2026-10-28T09:30:00+00:00', last_checked_at: '2026-10-28T09:30:00+00:00' },
        { source: 'mef_detalle_inversiones', last_success_at: 'x', last_checked_at: '2026-10-28T10:05:00+00:00' },
      ],
      error: null,
    });
    const repo = createSupabaseInvestmentsRepository(client);

    expect(await repo.getDataFreshness()).toEqual({
      ssiLastSuccessAt: '2026-10-28T09:30:00+00:00',
      openDataCheckedAt: '2026-10-28T10:05:00+00:00',
    });
    expect(calls).toContainEqual(['from', 'data_freshness']);
    expect(calls).toContainEqual(['select', 'source, last_success_at, last_checked_at']);
  });
});

describe('supabase cost history', () => {
  const changeRow = {
    id: '3',
    cui: '2088142',
    change_kind: 'changed',
    observed_at: '2026-11-03T10:00:00+00:00',
    source_updated_at: null,
    previous_viable_amount: '1338419640',
    viable_amount: '1338419640',
    previous_updated_cost: '5101412126',
    updated_cost: '5145412126',
    accrued_total: null,
    updated_cost_delta: '44000000',
  };

  it('reads the history of one investment, oldest first', async () => {
    const { client, calls } = fakeClient({ data: [changeRow], error: null });
    const repo = createSupabaseInvestmentsRepository(client);

    const history = await repo.getCostHistory('2088142');

    expect(history).toEqual([expect.objectContaining({ id: 3, kind: 'changed', updatedCostDelta: 44_000_000 })]);
    expect(calls).toEqual([
      ['from', 'investment_cost_changes'],
      ['select', COST_CHANGE_COLUMNS],
      ['eq', 'cui', '2088142'],
      ['order', 'observed_at', { ascending: true }],
      ['order', 'id', { ascending: true }],
    ]);
  });

  it('reads recent increases of a department through the embedded investment, newest first', async () => {
    const { client, calls } = fakeClient({
      data: [{ ...changeRow, investments: { name: 'Majes Siguas II etapa', department_code: 4, government_level: 'GR' } }],
      error: null,
    });
    const repo = createSupabaseInvestmentsRepository(client);

    const increases = await repo.getRecentCostIncreases({ departmentCode: 4, level: 'GR', limit: 5 });

    expect(increases).toEqual([
      expect.objectContaining({
        cui: '2088142',
        name: 'Majes Siguas II etapa',
        updatedCostDelta: 44_000_000,
        governmentLevel: 'GR',
      }),
    ]);
    expect(calls).toEqual([
      ['from', 'investment_cost_changes'],
      ['select', `${COST_CHANGE_COLUMNS},investments!inner(name,department_code,government_level)`],
      ['eq', 'change_kind', 'changed'],
      ['gt', 'updated_cost_delta', 0],
      ['eq', 'investments.department_code', 4],
      ['eq', 'investments.government_level', 'GR'],
      ['order', 'observed_at', { ascending: false }],
      ['order', 'id', { ascending: false }],
      ['limit', 5],
    ]);
  });

  it('reads recent increases in all of Peru with the department of each investment', async () => {
    const { client, calls } = fakeClient({
      data: [{ ...changeRow, investments: { name: 'Majes Siguas II etapa', department_code: 4 } }],
      error: null,
    });
    const repo = createSupabaseInvestmentsRepository(client);

    const increases = await repo.getRecentCostIncreases({ limit: 5 });

    expect(increases).toEqual([expect.objectContaining({ cui: '2088142', departmentCode: 4 })]);
    expect(calls).toEqual([
      ['from', 'investment_cost_changes'],
      ['select', `${COST_CHANGE_COLUMNS},investments!inner(name,department_code,government_level)`],
      ['eq', 'change_kind', 'changed'],
      ['gt', 'updated_cost_delta', 0],
      ['order', 'observed_at', { ascending: false }],
      ['order', 'id', { ascending: false }],
      ['limit', 5],
    ]);
  });

  it('throws when Supabase returns an error', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } });
    const repo = createSupabaseInvestmentsRepository(client);
    await expect(repo.getCostHistory('1')).rejects.toThrow('boom');
    await expect(repo.getRecentCostIncreases({ departmentCode: 4, limit: 5 })).rejects.toThrow('boom');
  });
});

describe('supabase stalled investments', () => {
  const stalledRow = {
    ...sampleRow({ cui: '7', updated: 297_000_000, progress: 0.32, lastAccrualMonth: '2025-04-01' }),
    months_without_accrual: 18,
    pending_amount: '201960000',
  };

  it('reads a page of the view for a department, largest pending amount first', async () => {
    const { client, calls } = fakeClient({ data: [stalledRow], error: null });
    const repo = createSupabaseInvestmentsRepository(client);

    const items = await repo.getStalledInvestments({ departmentCode: 23, level: 'GL', page: 1, pageSize: 10 });

    expect(items).toEqual([
      expect.objectContaining({ cui: '7', monthsWithoutAccrual: 18, pendingAmount: 201_960_000 }),
    ]);
    expect(calls).toEqual([
      ['from', 'stalled_investments_by_level'],
      ['select', STALLED_INVESTMENT_COLUMNS],
      ['eq', 'department_code', 23],
      ['eq', 'government_level', 'GL'],
      ['order', 'pending_amount', { ascending: false, nullsFirst: false }],
      ['order', 'cui', { ascending: true, nullsFirst: false }],
      ['range', 10, 19],
    ]);
  });

  it('counts the department rows without fetching them', async () => {
    const { client, calls } = fakeClient({ data: null, error: null, count: 12 });
    const repo = createSupabaseInvestmentsRepository(client);

    expect(await repo.countStalledInvestments(23, 'GN')).toBe(12);
    expect(calls).toEqual([
      ['from', 'stalled_investments_by_level'],
      ['select', 'cui', { count: 'exact', head: true }],
      ['eq', 'department_code', 23],
      ['eq', 'government_level', 'GN'],
    ]);
  });

  it('pages and counts all of Peru without a department filter', async () => {
    const page = fakeClient({ data: [stalledRow], error: null });
    await createSupabaseInvestmentsRepository(page.client).getStalledInvestments({ page: 0, pageSize: 3 });
    expect(page.calls).toEqual([
      ['from', 'stalled_investments_by_level'],
      ['select', STALLED_INVESTMENT_COLUMNS],
      ['order', 'pending_amount', { ascending: false, nullsFirst: false }],
      ['order', 'cui', { ascending: true, nullsFirst: false }],
      ['range', 0, 2],
    ]);

    const count = fakeClient({ data: null, error: null, count: 4321 });
    expect(await createSupabaseInvestmentsRepository(count.client).countStalledInvestments(undefined)).toBe(4321);
    expect(count.calls).toEqual([
      ['from', 'stalled_investments_by_level'],
      ['select', 'cui', { count: 'exact', head: true }],
    ]);
  });

  it('reads the reference month of the accrual data', async () => {
    const { client, calls } = fakeClient({ data: { reference_month: '2026-10-01' }, error: null });
    const repo = createSupabaseInvestmentsRepository(client);

    expect(await repo.getAccrualReferenceMonth()).toBe('2026-10-01');
    expect(calls).toEqual([
      ['from', 'accrual_reference_month_all_levels'],
      ['select', 'reference_month'],
      ['maybeSingle'],
    ]);
  });

  it('has no reference month when the view is empty', async () => {
    const { client } = fakeClient({ data: { reference_month: null }, error: null });
    expect(await createSupabaseInvestmentsRepository(client).getAccrualReferenceMonth()).toBeNull();
  });

  it('throws when Supabase returns an error', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } });
    const repo = createSupabaseInvestmentsRepository(client);
    await expect(repo.getStalledInvestments({ departmentCode: 4, page: 0 })).rejects.toThrow('boom');
    await expect(repo.countStalledInvestments(4)).rejects.toThrow('boom');
    await expect(repo.getAccrualReferenceMonth()).rejects.toThrow('boom');
  });
});

describe('supabase region comparison', () => {
  const regionRow = {
    department_code: 4,
    department_name: 'AREQUIPA',
    project_count: 1638,
    active_count: '1200',
    valid_cost_count: 1500,
    total_viable_amount: '13380000000.5',
    total_updated_cost: '17190000000',
    total_cost_increase: '3809492486',
    projects_with_increase: 412,
    cost_increase_pct: '28.47',
    overspent_count: 8,
    stalled_count: 12,
    stalled_pending_amount: '202000000',
  };

  it('reads every department and level from the region_comparison_by_level view', async () => {
    const { client, calls } = fakeClient({ data: [regionRow], error: null });
    const repo = createSupabaseInvestmentsRepository(client);

    expect(await repo.getRegionComparison()).toEqual([
      {
        departmentCode: 4,
        departmentName: 'AREQUIPA',
        projectCount: 1638,
        activeCount: 1200,
        validCostCount: 1500,
        totalViableAmount: 13_380_000_000.5,
        totalUpdatedCost: 17_190_000_000,
        totalCostIncrease: 3_809_492_486,
        projectsWithIncrease: 412,
        costIncreasePct: 28.47,
        overspentCount: 8,
        stalledCount: 12,
        stalledPendingAmount: 202_000_000,
      },
    ]);
    expect(calls).toEqual([
      ['from', 'region_comparison_by_level'],
      ['select', REGION_COMPARISON_COLUMNS],
      ['eq', 'government_level', 'ALL'],
      ['order', 'department_code', { ascending: true }],
    ]);
  });

  it('reads the departments of one level', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await createSupabaseInvestmentsRepository(client).getRegionComparison('GL');
    expect(calls).toContainEqual(['eq', 'government_level', 'GL']);
  });

  it('throws when Supabase returns an error', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } });
    await expect(createSupabaseInvestmentsRepository(client).getRegionComparison()).rejects.toThrow('boom');
  });
});

describe('supabase entity comparison', () => {
  it('reads a page of entities of a department and level, sorted by the view figure', async () => {
    const { client, calls } = fakeClient({
      data: [
        {
          entity: 'MUNICIPALIDAD DISTRITAL DE CAYMA',
          government_level: 'GL',
          scope_department_code: 4,
          department_code: 4,
          department_name: 'AREQUIPA',
          project_count: '12',
          valid_cost_count: 10,
          total_updated_cost: '50000000',
          total_cost_increase: '8000000',
          projects_with_increase: 3,
          increased_viable_amount: '20000000',
          cost_increase_pct: '40',
          overspent_count: 1,
          stalled_count: 2,
          stalled_pending_amount: '7000000',
        },
      ],
      error: null,
    });
    const repo = createSupabaseInvestmentsRepository(client);

    const entities = await repo.getEntityComparison({ sort: 'increase-amount', departmentCode: 4, level: 'GL', page: 1 });

    expect(entities).toEqual([
      expect.objectContaining({ entity: 'MUNICIPALIDAD DISTRITAL DE CAYMA', governmentLevel: 'GL', totalCostIncrease: 8_000_000 }),
    ]);
    expect(calls).toEqual([
      ['from', 'entity_comparison'],
      ['select', ENTITY_COMPARISON_COLUMNS],
      ['eq', 'scope_department_code', 4],
      ['eq', 'government_level', 'GL'],
      ['gt', 'total_cost_increase', 0],
      ['order', 'total_cost_increase', { ascending: false, nullsFirst: false }],
      ['order', 'entity', { ascending: true, nullsFirst: false }],
      ['order', 'government_level', { ascending: true, nullsFirst: false }],
      ['range', 30, 59],
    ]);
  });

  it('reads the national rows of every level', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await createSupabaseInvestmentsRepository(client).getEntityComparison({ sort: 'stalled', level: 'ALL', page: 0 });
    expect(calls).toContainEqual(['eq', 'scope_department_code', 0]);
    expect(calls.some(([method, column]) => method === 'eq' && column === 'government_level')).toBe(false);
  });

  it('reads the map through the map_points function', async () => {
    const { client, calls } = fakeClient({
      data: [
        {
          kind: 'cluster',
          cui: null,
          name: null,
          latitude: -16.4,
          longitude: -71.5,
          point_count: 1200,
          government_level: null,
          cost_increase: null,
          cost_increase_pct: null,
          updated_cost_valid: null,
          total_cost_increase: '900000000',
          max_cost_increase_pct: '310',
          increased_count: 210,
        },
      ],
      error: null,
    });
    const repo = createSupabaseInvestmentsRepository(client);
    const bbox = { minLat: -17.5, minLon: -75.1, maxLat: -14.6, maxLon: -70.8 };

    const result = await repo.getMapPoints({ bbox, zoom: 7, level: 'GR', departmentCode: 4 });
    await repo.getMapPoints({ bbox, zoom: 5, level: 'ALL' });

    expect(result).toEqual({
      kind: 'clusters',
      clusters: [expect.objectContaining({ count: 1200, totalCostIncrease: 900_000_000 })],
    });
    expect(calls).toEqual([
      ['rpc', 'map_points', { min_lat: -17.5, min_lon: -75.1, max_lat: -14.6, max_lon: -70.8, zoom: 7, level: 'GR', department: 4 }],
      ['rpc', 'map_points', { min_lat: -17.5, min_lon: -75.1, max_lat: -14.6, max_lon: -70.8, zoom: 5, level: 'ALL', department: null }],
    ]);
  });

  it('sends the map filters to map_points', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    const bbox = { minLat: -17.5, minLon: -75.1, maxLat: -14.6, maxLon: -70.8 };
    await createSupabaseInvestmentsRepository(client).getMapPoints({
      bbox,
      zoom: 9,
      level: 'ALL',
      filters: ['stalled', 'overspent'],
    });
    expect(calls).toEqual([
      [
        'rpc',
        'map_points',
        {
          min_lat: -17.5,
          min_lon: -75.1,
          max_lat: -14.6,
          max_lon: -70.8,
          zoom: 9,
          level: 'ALL',
          department: null,
          only_increase: false,
          only_stalled: true,
          only_overspent: true,
        },
      ],
    ]);
  });

  it('reads a page of the map list through map_list', async () => {
    const { client, calls } = fakeClient({
      data: [
        {
          cui: '1',
          name: 'Uno',
          entity: null,
          government_level: 'GR',
          status: 'ACTIVO',
          latitude: -16.4,
          longitude: -71.5,
          updated_cost: 2000,
          updated_cost_valid: true,
          accrued_total: 100,
          cost_increase: 1000,
          cost_increase_pct: 100,
          execution_progress: 0.05,
          spent_anomaly: false,
          physical_progress: null,
          last_accrual_month: null,
          stalled: false,
          total_count: 31,
        },
      ],
      error: null,
    });
    const bbox = { minLat: -17.5, minLon: -75.1, maxLat: -14.6, maxLon: -70.8 };
    const page = await createSupabaseInvestmentsRepository(client).getMapList({
      bbox,
      level: 'GR',
      departmentCode: 4,
      filters: ['increase'],
      page: 1,
    });
    expect(page).toEqual({ total: 31, items: [expect.objectContaining({ cui: '1', costIncrease: 1000 })] });
    expect(calls).toEqual([
      [
        'rpc',
        'map_list',
        {
          min_lat: -17.5,
          min_lon: -75.1,
          max_lat: -14.6,
          max_lon: -70.8,
          level: 'GR',
          department: 4,
          only_increase: true,
          only_stalled: false,
          only_overspent: false,
          page_limit: 30,
          page_offset: 30,
        },
      ],
    ]);
  });

  it('throws the map_list error', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'timeout' } });
    await expect(
      createSupabaseInvestmentsRepository(client).getMapList({ bbox: { minLat: -19, minLon: -82, maxLat: 0, maxLon: -68 }, level: 'ALL', page: 0 }),
    ).rejects.toThrow('timeout');
  });

  it('throws the map_points error', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'timeout' } });
    await expect(
      createSupabaseInvestmentsRepository(client).getMapPoints({
        bbox: { minLat: -19, minLon: -82, maxLat: 0, maxLon: -68 },
        zoom: 5,
        level: 'ALL',
      }),
    ).rejects.toThrow('timeout');
  });
});
