import type { SupabaseClient } from '@supabase/supabase-js';

import { buildRankingQuery } from '../domain/queries';
import { createSupabaseInvestmentsRepository } from './supabaseInvestmentsRepository';

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

const bbox = { minLat: -17.5, minLon: -75.1, maxLat: -14.6, maxLon: -70.8 };

describe('supabase repository with a status filter', () => {
  it('filters direct investment reads by MEF status', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await createSupabaseInvestmentsRepository(client).findMany(
      buildRankingQuery({ kind: 'cost', status: 'CLOSED', page: 0 }),
    );
    expect(calls).toContainEqual(['eq', 'status', 'CERRADO']);
  });

  it('selects the closure facts with every investment', async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    await createSupabaseInvestmentsRepository(client).findByCui('1');
    expect(calls[1]).toEqual(['select', expect.stringContaining('closed_at')]);
    expect(calls[1]).toEqual(['select', expect.stringContaining('liquidation_amount')]);
  });

  it('reads one status group of the national function summaries', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await createSupabaseInvestmentsRepository(client).functionSummaries(undefined, 'ALL', 'ACTIVE');
    expect(calls).toEqual([
      ['from', 'function_summary_by_status'],
      ['select', '*'],
      ['eq', 'government_level', 'ALL'],
      ['eq', 'status_group', 'ACTIVE'],
      ['order', 'total_updated_cost', { ascending: false, nullsFirst: false }],
    ]);
  });

  it('reads one status group of a department function summary', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await createSupabaseInvestmentsRepository(client).functionSummaries(4, 'GL', 'CLOSED');
    expect(calls.slice(0, 5)).toEqual([
      ['from', 'department_function_summary_by_status'],
      ['select', '*'],
      ['eq', 'government_level', 'GL'],
      ['eq', 'status_group', 'CLOSED'],
      ['eq', 'department_code', 4],
    ]);
  });

  it('reads one status group of the region comparison', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await createSupabaseInvestmentsRepository(client).getRegionComparison('GR', 'CLOSED');
    expect(calls).toEqual([
      ['from', 'region_comparison_by_status'],
      ['select', expect.stringContaining('stalled_count')],
      ['eq', 'government_level', 'GR'],
      ['eq', 'status_group', 'CLOSED'],
      ['order', 'department_code', { ascending: true }],
    ]);
  });

  it('reads one status group of the entity comparison', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await createSupabaseInvestmentsRepository(client).getEntityComparison({
      sort: 'increase-amount',
      status: 'ALL',
      page: 0,
    });
    expect(calls[0]).toEqual(['from', 'entity_comparison_by_status']);
    expect(calls).toContainEqual(['eq', 'status_group', 'ALL']);
  });

  it('filters recent increases by the status of the embedded investment', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await createSupabaseInvestmentsRepository(client).getRecentCostIncreases({ status: 'ACTIVE', limit: 5 });
    expect(calls).toContainEqual(['eq', 'investments.status', 'ACTIVO']);
  });

  it('never asks for stalled projects among closed ones (the rule needs ACTIVO)', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    const repo = createSupabaseInvestmentsRepository(client);
    await expect(repo.getStalledInvestments({ status: 'CLOSED', page: 0 })).resolves.toEqual([]);
    await expect(repo.countStalledInvestments(undefined, 'ALL', 'CLOSED')).resolves.toBe(0);
    expect(calls).toEqual([]);
  });

  it('sends the status to map_points and map_list', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    const repo = createSupabaseInvestmentsRepository(client);
    await repo.getMapPoints({ bbox, zoom: 7, level: 'ALL', status: 'CLOSED' });
    await repo.getMapList({ bbox, level: 'ALL', status: 'ACTIVE', page: 0 });
    expect(calls[0]).toEqual(['rpc', 'map_points', expect.objectContaining({ status_filter: 'CLOSED' })]);
    expect(calls[1]).toEqual(['rpc', 'map_list', expect.objectContaining({ status_filter: 'ACTIVE' })]);
  });
});
