import type { SupabaseClient } from '@supabase/supabase-js';

import { buildRankingQuery, buildSearchQuery, buildFunctionQuery } from '../domain/queries';
import { createSupabaseInvestmentsRepository } from './supabaseInvestmentsRepository';
import { sampleRow } from './sampleData';

type Call = [string, ...unknown[]];

/** Chainable PostgREST builder fake that records every call and resolves to `result`. */
function fakeClient(result: { data: unknown; error: { message: string } | null }) {
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
      ['not', 'updated_cost', 'is', null],
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

  it('reads function summaries for a department from the per-department view', async () => {
    const { client, calls } = fakeClient({
      data: [{ department_code: 4, function: 'SALUD', investment_count: 3, total_updated_cost: '10', total_cost_increase: '2' }],
      error: null,
    });
    const repo = createSupabaseInvestmentsRepository(client);

    expect(await repo.functionSummaries(4)).toEqual([
      { function: 'SALUD', investmentCount: 3, totalUpdatedCost: 10, totalCostIncrease: 2 },
    ]);
    expect(calls[0]).toEqual(['from', 'department_function_summary']);
    expect(calls).toContainEqual(['eq', 'department_code', 4]);
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
});
