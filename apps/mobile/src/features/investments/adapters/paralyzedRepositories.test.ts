import type { SupabaseClient } from '@supabase/supabase-js';

import type { ParalyzedWork } from '../domain/paralyzed';
import { createInMemoryInvestmentsRepository } from './inMemoryInvestmentsRepository';
import { sampleRow } from './sampleData';
import { createSupabaseInvestmentsRepository } from './supabaseInvestmentsRepository';

type Call = [string, ...unknown[]];

/** Chainable PostgREST builder fake: records every call and resolves each read with the next result. */
function fakeClient(...results: { data: unknown; error: { message: string } | null; count?: number | null }[]) {
  const calls: Call[] = [];
  const next = () => results.shift() ?? { data: [], error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'gt', 'gte', 'ilike', 'not', 'is', 'order', 'range', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.maybeSingle = () => {
    calls.push(['maybeSingle']);
    return Promise.resolve(next());
  };
  builder.then = (resolve: (value: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(next()).then(resolve, reject);
  const client = {
    from: (table: string) => {
      calls.push(['from', table]);
      return builder;
    },
    rpc: (fn: string, args: unknown) => {
      calls.push(['rpc', fn, args]);
      return Promise.resolve(next());
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const SUMMARY_ROW = {
  cui: '2151761',
  edition_cutoff: '2026-06-30',
  published_at: '2026-08-17',
  obra_count: 2,
  main_causal_label: 'FALTA DE RECURSOS FINANCIEROS Y LIQUIDEZ',
  min_physical_progress: 31,
  max_physical_progress: 60,
  total_remaining_work_balance: 2_000_000,
  infobras_codes: [45282, 45283],
};

describe('supabase repository: paralyzed works', () => {
  it('reads the summary and the obras of a CUI', async () => {
    const { client, calls } = fakeClient(
      { data: SUMMARY_ROW, error: null },
      { data: [{ infobras_code: 45282, cui: '2151761', edition_cutoff: '2026-06-30', causal_label: 'X' }], error: null },
    );

    const detail = await createSupabaseInvestmentsRepository(client).getParalyzedDetail('2151761');

    expect(detail?.summary).toMatchObject({ cui: '2151761', obraCount: 2, infobrasCodes: [45282, 45283] });
    expect(detail?.works.map((w) => w.infobrasCode)).toEqual([45282]);
    expect(calls).toEqual([
      ['from', 'paralyzed_by_cui'],
      ['select', expect.stringContaining('total_remaining_work_balance')],
      ['eq', 'cui', '2151761'],
      ['maybeSingle'],
      ['from', 'latest_paralyzed_works'],
      ['select', expect.stringContaining('mef_report_url')],
      ['eq', 'cui', '2151761'],
      ['order', 'remaining_work_balance', { ascending: false, nullsFirst: false }],
      ['order', 'infobras_code', { ascending: true, nullsFirst: false }],
    ]);
  });

  it('is null when the CUI is not in the latest edition', async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    expect(await createSupabaseInvestmentsRepository(client).getParalyzedDetail('1')).toBeNull();
    expect(calls.filter(([op]) => op === 'from')).toHaveLength(1);
  });

  it('ranks paralyzed investments within the scope and counts them', async () => {
    const { client, calls } = fakeClient(
      { data: [{ ...SUMMARY_ROW, name: 'Agua', entity: 'MUNI', department_code: 8, government_level: 'GL', status: 'ACTIVO' }], error: null },
      { data: null, error: null, count: 42 },
    );
    const repo = createSupabaseInvestmentsRepository(client);

    const items = await repo.getParalyzedInvestments({ departmentCode: 8, level: 'GL', status: 'ACTIVE', page: 0 });
    const total = await repo.countParalyzedInvestments(8, 'GL', 'ACTIVE');

    expect(items).toEqual([expect.objectContaining({ cui: '2151761', name: 'Agua', governmentLevel: 'GL' })]);
    expect(total).toBe(42);
    expect(calls).toEqual([
      ['from', 'paralyzed_investments'],
      ['select', expect.stringContaining('main_causal_label')],
      ['eq', 'department_code', 8],
      ['eq', 'government_level', 'GL'],
      ['eq', 'status', 'ACTIVO'],
      ['order', 'total_remaining_work_balance', { ascending: false, nullsFirst: false }],
      ['order', 'cui', { ascending: true, nullsFirst: false }],
      ['range', 0, 29],
      ['from', 'paralyzed_investments'],
      ['select', 'cui', { count: 'exact', head: true }],
      ['eq', 'department_code', 8],
      ['eq', 'government_level', 'GL'],
      ['eq', 'status', 'ACTIVO'],
    ]);
  });

  it('reads the latest edition', async () => {
    const { client, calls } = fakeClient({ data: { edition_cutoff: '2026-06-30', published_at: '2026-08-17' }, error: null });
    expect(await createSupabaseInvestmentsRepository(client).getParalyzedEdition()).toEqual({
      editionCutoff: '2026-06-30',
      publishedAt: '2026-08-17',
    });
    expect(calls).toEqual([
      ['from', 'latest_paralyzed_works'],
      ['select', 'edition_cutoff,published_at'],
      ['limit', 1],
      ['maybeSingle'],
    ]);
  });

  it('sends only_paralyzed to the map functions only when the filter is on', async () => {
    const { client, calls } = fakeClient({ data: [], error: null }, { data: [], error: null });
    const repo = createSupabaseInvestmentsRepository(client);
    const bbox = { minLat: -17.5, minLon: -75.1, maxLat: -14.6, maxLon: -70.8 };

    await repo.getMapPoints({ bbox, zoom: 9, level: 'ALL', filters: ['paralyzed'] });
    await repo.getMapList({ bbox, level: 'ALL', filters: ['increase'], page: 0 });

    expect(calls[0]).toEqual(['rpc', 'map_points', expect.objectContaining({ only_paralyzed: true, only_increase: false })]);
    expect(calls[1]![2]).not.toHaveProperty('only_paralyzed');
  });
});

const WORKS: ParalyzedWork[] = [
  {
    infobrasCode: 45282,
    cui: '9900001',
    editionCutoff: '2026-06-30',
    publishedAt: '2026-08-17',
    obraDescription: 'Obra A',
    causalCode: 2,
    causalLabel: 'INCUMPLIMIENTO DE CONTRATO',
    physicalProgress: 31,
    remainingWorkBalance: 800_000,
    mefReportUrl: 'https://ofi5.mef.gob.pe/x.pdf',
  },
  {
    infobrasCode: 45283,
    cui: '9900001',
    editionCutoff: '2026-06-30',
    publishedAt: '2026-08-17',
    obraDescription: 'Obra B',
    causalCode: 10,
    causalLabel: 'FALTA DE RECURSOS FINANCIEROS Y LIQUIDEZ',
    physicalProgress: 60,
    remainingWorkBalance: 1_200_000,
    mefReportUrl: null,
  },
  {
    infobrasCode: 9,
    cui: '9900002',
    editionCutoff: '2026-06-30',
    publishedAt: '2026-08-17',
    obraDescription: 'Obra C',
    causalCode: 1,
    causalLabel: 'ABANDONO DE OBRA',
    physicalProgress: 5,
    remainingWorkBalance: 3_000_000,
    mefReportUrl: null,
  },
  {
    infobrasCode: 10,
    cui: '5555555',
    editionCutoff: '2026-06-30',
    publishedAt: '2026-08-17',
    obraDescription: 'Not in Fiscus',
    causalCode: 15,
    causalLabel: 'OTROS',
    physicalProgress: 1,
    remainingWorkBalance: 9_000_000,
    mefReportUrl: null,
  },
];

describe('in-memory repository: paralyzed works', () => {
  const repository = createInMemoryInvestmentsRepository({
    rows: [
      sampleRow({ cui: '9900001', name: 'Planta', departmentCode: 4, coordinates: { latitude: -16.4, longitude: -71.5 } }),
      sampleRow({ cui: '9900002', name: 'Carretera', departmentCode: 4, level: 'GL', status: 'CERRADO', coordinates: { latitude: -16.5, longitude: -71.6 } }),
      sampleRow({ cui: '9900003', name: 'Otra', departmentCode: 8, coordinates: { latitude: -13.5, longitude: -71.9 } }),
    ],
    lastRun: null,
    paralyzedWorks: WORKS,
  });

  it('summarizes the obras of a CUI, largest balance first', async () => {
    const detail = await repository.getParalyzedDetail('9900001');
    expect(detail?.summary).toMatchObject({ obraCount: 2, mainCausalLabel: 'FALTA DE RECURSOS FINANCIEROS Y LIQUIDEZ', totalRemainingWorkBalance: 2_000_000 });
    expect(detail?.works.map((w) => w.infobrasCode)).toEqual([45283, 45282]);
    expect(await repository.getParalyzedDetail('9900003')).toBeNull();
  });

  it('ranks only the CUIs Fiscus has, within the scope, level and status', async () => {
    const all = await repository.getParalyzedInvestments({ level: 'ALL', status: 'ALL', page: 0 });
    expect(all.map((i) => i.cui)).toEqual(['9900002', '9900001']);
    expect((await repository.getParalyzedInvestments({ level: 'ALL', status: 'ACTIVE', page: 0 })).map((i) => i.cui)).toEqual(['9900001']);
    expect(await repository.getParalyzedInvestments({ departmentCode: 8, level: 'ALL', status: 'ALL', page: 0 })).toEqual([]);
    expect(await repository.countParalyzedInvestments(undefined, 'GL', 'ALL')).toBe(1);
    expect(await repository.countParalyzedInvestments(4, 'ALL', 'ACTIVE')).toBe(1);
  });

  it('reads the edition and filters the map', async () => {
    expect(await repository.getParalyzedEdition()).toEqual({ editionCutoff: '2026-06-30', publishedAt: '2026-08-17' });
    const bbox = { minLat: -19, minLon: -82, maxLat: 0, maxLon: -68 };
    const points = await repository.getMapPoints({ bbox, zoom: 6, level: 'ALL', filters: ['paralyzed'] });
    expect(points).toEqual({ kind: 'points', points: expect.any(Array) });
    if (points.kind !== 'points') throw new Error('points expected');
    expect(points.points.map((p) => [p.cui, p.paralyzed])).toEqual([
      ['9900001', true],
      ['9900002', true],
    ]);
    const list = await repository.getMapList({ bbox, level: 'ALL', page: 0 });
    expect(list.items.find((i) => i.cui === '9900003')?.paralyzed).toBe(false);
  });

  it('has no paralyzed works without a seed', async () => {
    const empty = createInMemoryInvestmentsRepository({ rows: [], lastRun: null });
    expect(await empty.getParalyzedEdition()).toBeNull();
    expect(await empty.countParalyzedInvestments()).toBe(0);
  });
});
