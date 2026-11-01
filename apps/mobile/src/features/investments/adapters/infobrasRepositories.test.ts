import type { SupabaseClient } from '@supabase/supabase-js';

import { mapInfobrasWorkRow, type InfobrasWork } from '../domain/infobras';
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

describe('supabase repository: INFOBRAS', () => {
  it('reads the obras of a CUI, largest contract first', async () => {
    const { client, calls } = fakeClient({
      data: [{ infobras_code: 36233, cui: '2132947', contractor_kind: 'empresa', contractor_ruc: '20301552115' }],
      error: null,
    });

    const works = await createSupabaseInvestmentsRepository(client).getInfobrasWorks('2132947');

    expect(works.map((w) => w.infobrasCode)).toEqual([36233]);
    expect(calls).toEqual([
      ['from', 'infobras_works'],
      ['select', expect.stringContaining('supervisor_kind')],
      ['eq', 'cui', '2132947'],
      ['order', 'contract_amount_valid', { ascending: false }],
      ['order', 'contract_amount', { ascending: false, nullsFirst: false }],
      ['order', 'infobras_code', { ascending: true, nullsFirst: false }],
      ['limit', 100],
    ]);
  });

  it('reads the date the INFOBRAS data describes', async () => {
    const { client, calls } = fakeClient({ data: { data_as_of: '2026-03-31' }, error: null });
    expect(await createSupabaseInvestmentsRepository(client).getInfobrasDataAsOf()).toBe('2026-03-31');
    expect(calls).toEqual([
      ['from', 'data_freshness'],
      ['select', 'data_as_of'],
      ['eq', 'source', 'infobras_obras'],
      ['maybeSingle'],
    ]);
  });

  it('ranks contractors in the scope through contractor_ranking', async () => {
    const { client, calls } = fakeClient({
      data: [
        {
          contractor_ruc: '20301552115',
          contractor_name: 'A',
          contractor_kind: 'empresa',
          obra_count: 3,
          total_contract_amount: 10,
          total_additional_works: 1,
          contraloria_paralyzed_count: 0,
          total_count: 12,
          data_as_of: '2026-03-31',
        },
      ],
      error: null,
    });

    const page = await createSupabaseInvestmentsRepository(client).getContractorRanking({
      sort: 'additional',
      departmentCode: 8,
      level: 'GL',
      status: 'ACTIVE',
      page: 1,
    });

    expect(page).toMatchObject({ total: 12, dataAsOf: '2026-03-31', items: [expect.objectContaining({ ruc: '20301552115' })] });
    expect(calls).toEqual([
      [
        'rpc',
        'contractor_ranking',
        { level: 'GL', department: 8, status_filter: 'ACTIVE', sort_by: 'additional', page_limit: 30, page_offset: 30 },
      ],
    ]);
  });

  it('reads the summary and the obras of a contractor', async () => {
    const { client, calls } = fakeClient(
      { data: { contractor_ruc: '20301552115', contractor_name: 'A', obra_count: 2 }, error: null },
      { data: [{ infobras_code: 1, investment_name: 'Agua', contraloria_paralyzed: true }], error: null },
    );
    const repo = createSupabaseInvestmentsRepository(client);

    expect(await repo.getContractorSummary('20301552115')).toMatchObject({ ruc: '20301552115', obraCount: 2 });
    expect(await repo.getContractorWorks({ ruc: '20301552115', page: 0 })).toEqual([
      expect.objectContaining({ infobrasCode: 1, investmentName: 'Agua', contraloriaParalyzed: true }),
    ]);
    expect(calls).toEqual([
      ['from', 'contractor_summary'],
      ['select', expect.stringContaining('infobras_paralyzed_count')],
      ['eq', 'contractor_ruc', '20301552115'],
      ['maybeSingle'],
      ['from', 'contractor_works'],
      ['select', expect.stringContaining('investment_name')],
      ['eq', 'contractor_ruc', '20301552115'],
      ['order', 'contract_amount_valid', { ascending: false }],
      ['order', 'contract_amount', { ascending: false, nullsFirst: false }],
      ['order', 'infobras_code', { ascending: true, nullsFirst: false }],
      ['range', 0, 29],
    ]);
  });

  it('is null for an unknown contractor', async () => {
    const { client } = fakeClient({ data: null, error: null });
    expect(await createSupabaseInvestmentsRepository(client).getContractorSummary('20999999999')).toBeNull();
  });
});

describe('in-memory repository: INFOBRAS', () => {
  const works: InfobrasWork[] = [
    {
      ...mapInfobrasWorkRow({ infobras_code: 10, cui: '9900001', execution_status: 'En Ejecución' }),
      contractor: { kind: 'empresa', ruc: '20100000001', name: 'CONSTRUCTORA A (demo)' },
      contractAmount: 500,
      additionalWorksAmount: 20,
    },
    {
      ...mapInfobrasWorkRow({ infobras_code: 11, cui: '9900001', execution_status: 'Finalizado' }),
      contractor: { kind: 'empresa', ruc: '20100000001', name: 'CONSTRUCTORA A (demo)' },
      contractAmount: 900,
    },
    {
      ...mapInfobrasWorkRow({ infobras_code: 12, cui: '9900002', execution_status: 'Paralizada' }),
      contractor: { kind: 'persona_natural', ruc: null, name: null },
      contractAmount: 100,
    },
    {
      ...mapInfobrasWorkRow({ infobras_code: 13, cui: '9900001', execution_status: 'Paralizada' }),
      contractor: { kind: 'empresa', ruc: '20100000001', name: 'CONSTRUCTORA A (demo)' },
      contractAmount: 113_862_565_000,
      contractAmountValid: false,
    },
  ];
  const paralyzed: ParalyzedWork[] = [
    {
      infobrasCode: 10,
      cui: '9900001',
      editionCutoff: '2026-06-30',
      publishedAt: null,
      obraDescription: null,
      causalCode: null,
      causalLabel: null,
      physicalProgress: null,
      remainingWorkBalance: null,
      mefReportUrl: null,
    },
  ];
  const repo = createInMemoryInvestmentsRepository({
    rows: [
      sampleRow({ cui: '9900001', name: 'Agua (demo)', entity: 'MUNI (demo)', departmentCode: 4, status: 'ACTIVO' }),
      sampleRow({ cui: '9900002', name: 'Pista (demo)', departmentCode: 8, status: 'ACTIVO' }),
    ],
    lastRun: null,
    paralyzedWorks: paralyzed,
    infobrasWorks: works,
    infobrasDataAsOf: '2026-03-31',
  });

  it('serves the obras of a CUI largest valid contract first, invalid amounts last, and the data date', async () => {
    expect((await repo.getInfobrasWorks('9900001')).map((w) => w.infobrasCode)).toEqual([11, 10, 13]);
    expect(await repo.getInfobrasWorks('1')).toEqual([]);
    expect(await repo.getInfobrasDataAsOf()).toBe('2026-03-31');
  });

  it('ranks, summarizes and lists a contractor like the database', async () => {
    const page = await repo.getContractorRanking({ sort: 'contract', page: 0 });
    expect(page).toMatchObject({ total: 1, dataAsOf: '2026-03-31' });
    expect(page.items[0]).toMatchObject({
      ruc: '20100000001',
      obraCount: 3,
      totalContractAmount: 1400,
      contraloriaParalyzedCount: 1,
      invalidContractCount: 1,
    });

    expect(await repo.getContractorSummary('20100000001')).toMatchObject({
      obraCount: 3,
      totalContractAmount: 1400,
      invalidContractCount: 1,
      finishedCount: 1,
      inProgressCount: 1,
      contraloriaParalyzedCount: 1,
      dataAsOf: '2026-03-31',
    });
    expect(await repo.getContractorSummary('20999999999')).toBeNull();
    expect(await repo.getContractorWorks({ ruc: '20100000001', page: 0 })).toEqual([
      expect.objectContaining({ infobrasCode: 11, investmentName: 'Agua (demo)', departmentCode: 4, contraloriaParalyzed: false }),
      expect.objectContaining({ infobrasCode: 10, contraloriaParalyzed: true, contractAmountValid: true }),
      expect.objectContaining({ infobrasCode: 13, contractAmountValid: false }),
    ]);
  });
});
