import {
  isContractorSort,
  mapContractorRankingRows,
  mapContractorSummaryRow,
  mapContractorWorkRow,
  mapInfobrasWorkRow,
  rankContractors,
  toParty,
  type InfobrasWork,
  type WorkScope,
} from './infobras';

function work(code: number, overrides: Partial<InfobrasWork> = {}): InfobrasWork {
  return {
    ...mapInfobrasWorkRow({ infobras_code: code }),
    contractor: { kind: 'empresa', ruc: '20100000001', name: 'CONSTRUCTORA A (demo)' },
    ...overrides,
  };
}

describe('mapInfobrasWorkRow', () => {
  it('maps a row of infobras_works', () => {
    expect(
      mapInfobrasWorkRow({
        infobras_code: 36233,
        cui: '2132947',
        execution_status: 'En Ejecución',
        has_paralysis: true,
        paralysis_cause: 'Incumplimiento de contrato',
        paralysis_date: '2025-12-01',
        paralysis_days: 31,
        physical_progress_planned: '80',
        physical_progress_actual: '62.5',
        progress_period: '2025-12-01',
        contract_amount: '3158683.99',
        contractor_kind: 'consorcio',
        contractor_ruc: 'C0003136723',
        contractor_name: 'CONSORCIO VIAL',
        supervisor_kind: 'persona_natural',
        supervisor_ruc: null,
        supervisor_name: null,
        additional_works_amount: 159570.06,
        deductions_amount: null,
        extension_days: 45,
        reception_date: null,
        liquidation_date: null,
        modality: 'Contrata',
      }),
    ).toEqual({
      infobrasCode: 36233,
      cui: '2132947',
      executionStatus: 'En Ejecución',
      hasParalysis: true,
      paralysisCause: 'Incumplimiento de contrato',
      paralysisDate: '2025-12-01',
      paralysisDays: 31,
      physicalProgressPlanned: 80,
      physicalProgressActual: 62.5,
      progressPeriod: '2025-12-01',
      contractAmount: 3158683.99,
      contractAmountValid: true,
      contractor: { kind: 'consorcio', ruc: 'C0003136723', name: 'CONSORCIO VIAL' },
      supervisor: { kind: 'persona_natural', ruc: null, name: null },
      additionalWorksAmount: 159570.06,
      deductionsAmount: null,
      extensionDays: 45,
      receptionDate: null,
      liquidationDate: null,
      modality: 'Contrata',
    });
  });

  it('reads contract_amount_valid; only an explicit false marks the amount as invalid', () => {
    expect(
      mapInfobrasWorkRow({ infobras_code: 507248, contract_amount: '113862565000', contract_amount_valid: false }),
    ).toMatchObject({ contractAmount: 113862565000, contractAmountValid: false });
    expect(mapInfobrasWorkRow({ infobras_code: 1, contract_amount: 5 }).contractAmountValid).toBe(true);
  });

  it('keeps unknown statuses and kinds out', () => {
    expect(mapInfobrasWorkRow({ infobras_code: 1, execution_status: 'Otro', contractor_kind: 'x' })).toMatchObject({
      executionStatus: null,
      contractor: { kind: null, ruc: null, name: null },
    });
  });
});

describe('toParty', () => {
  it('never keeps the name or RUC of a natural person', () => {
    expect(toParty('persona_natural', '10412345678', 'JUAN PEREZ')).toEqual({ kind: 'persona_natural', ruc: null, name: null });
  });
});

describe('contractor rows', () => {
  it('maps a ranking page with its total and data date', () => {
    expect(
      mapContractorRankingRows([
        {
          contractor_ruc: '20100000001',
          contractor_name: 'A',
          contractor_kind: 'empresa',
          obra_count: 3,
          total_contract_amount: '1000',
          total_additional_works: 0,
          contraloria_paralyzed_count: 1,
          invalid_contract_count: 2,
          total_count: 42,
          data_as_of: '2026-03-31',
        },
      ]),
    ).toEqual({
      items: [
        {
          ruc: '20100000001',
          name: 'A',
          kind: 'empresa',
          obraCount: 3,
          totalContractAmount: 1000,
          totalAdditionalWorks: 0,
          contraloriaParalyzedCount: 1,
          invalidContractCount: 2,
        },
      ],
      total: 42,
      dataAsOf: '2026-03-31',
    });
    expect(mapContractorRankingRows([])).toEqual({ items: [], total: 0, dataAsOf: null });
  });

  it('maps a summary and an obra of a contractor', () => {
    expect(
      mapContractorSummaryRow({
        contractor_ruc: 'C0003136723',
        contractor_name: 'CONSORCIO VIAL',
        contractor_kind: 'consorcio',
        obra_count: 2,
        total_contract_amount: 5,
        total_additional_works: 1,
        contraloria_paralyzed_count: 0,
        finished_count: 1,
        in_progress_count: 1,
        not_started_count: 0,
        infobras_paralyzed_count: 0,
        data_as_of: '2026-03-31',
      }),
    ).toMatchObject({ ruc: 'C0003136723', finishedCount: 1, inProgressCount: 1, dataAsOf: '2026-03-31', invalidContractCount: 0 });
    expect(
      mapContractorWorkRow({
        infobras_code: 7,
        cui: null,
        execution_status: 'Finalizado',
        contract_amount: null,
        additional_works_amount: null,
        physical_progress_actual: 100,
        investment_name: null,
        entity: null,
        department_code: null,
        government_level: null,
        investment_status: null,
        contraloria_paralyzed: null,
      }),
    ).toMatchObject({ infobrasCode: 7, cui: null, executionStatus: 'Finalizado', contraloriaParalyzed: false, contractAmountValid: true });
    expect(
      mapContractorWorkRow({
        infobras_code: 507248,
        cui: '2499886',
        execution_status: 'Paralizada',
        contract_amount: '113862565000',
        additional_works_amount: null,
        physical_progress_actual: 97.37,
        investment_name: null,
        entity: null,
        department_code: null,
        government_level: null,
        investment_status: null,
        contraloria_paralyzed: true,
        contract_amount_valid: false,
      }),
    ).toMatchObject({ contractAmount: 113862565000, contractAmountValid: false });
  });
});

describe('isContractorSort', () => {
  it('accepts the three sorts only', () => {
    expect(['contract', 'additional', 'paralyzed'].every(isContractorSort)).toBe(true);
    expect(isContractorSort('stalled')).toBe(false);
  });
});

describe('rankContractors', () => {
  const scopes: Record<string, WorkScope> = {
    '1': { departmentCode: 4, governmentLevel: 'GR', status: 'ACTIVO' },
    '2': { departmentCode: 8, governmentLevel: 'GL', status: 'CERRADO' },
  };
  const scopeOf = (cui: string | null) => (cui === null ? null : (scopes[cui] ?? null));
  const B = { kind: 'consorcio' as const, ruc: 'C0000000002', name: 'CONSORCIO B (demo)' };
  const WORKS = [
    work(1, { cui: '1', contractAmount: 100, additionalWorksAmount: 50 }),
    work(2, { cui: '2', contractAmount: 300 }),
    work(3, { cui: null, contractor: B, contractAmount: 250, additionalWorksAmount: 10 }),
    work(4, { cui: '1', contractor: { kind: 'persona_natural', ruc: null, name: null }, contractAmount: 9_000 }),
    work(5, { cui: '1', contractor: { kind: 'consorcio', ruc: null, name: 'CONSORCIO SIN RUC' }, contractAmount: 9_000 }),
  ];

  it('ranks companies and consortia with a RUC nationally, by contract amount by default', () => {
    const { items, total } = rankContractors(WORKS, scopeOf, new Set([3]), { sort: 'contract', page: 0 });
    expect(total).toBe(2);
    expect(items).toEqual([
      expect.objectContaining({ ruc: '20100000001', obraCount: 2, totalContractAmount: 400, totalAdditionalWorks: 50 }),
      expect.objectContaining({ ruc: 'C0000000002', obraCount: 1, contraloriaParalyzedCount: 1 }),
    ]);
  });

  it('sorts by additional works or by obras in the Contraloría report', () => {
    expect(rankContractors(WORKS, scopeOf, new Set([3]), { sort: 'paralyzed', page: 0 }).items[0]?.ruc).toBe('C0000000002');
    expect(rankContractors(WORKS, scopeOf, new Set(), { sort: 'additional', page: 0 }).items[0]?.ruc).toBe('20100000001');
  });

  it('applies the scope of each obra investment; obras without one only count without filters', () => {
    expect(rankContractors(WORKS, scopeOf, new Set(), { sort: 'contract', departmentCode: 4, page: 0 }).items).toEqual([
      expect.objectContaining({ ruc: '20100000001', obraCount: 1, totalContractAmount: 100 }),
    ]);
    expect(rankContractors(WORKS, scopeOf, new Set(), { sort: 'contract', status: 'CLOSED', page: 0 }).items).toEqual([
      expect.objectContaining({ ruc: '20100000001', obraCount: 1, totalContractAmount: 300 }),
    ]);
    expect(rankContractors(WORKS, scopeOf, new Set(), { sort: 'contract', level: 'GN', page: 0 }).total).toBe(0);
  });

  it('sums only valid contract amounts and counts the invalid ones (Regla de Fiscus)', () => {
    const works = [
      ...WORKS,
      work(6, { cui: '1', contractAmount: 113_862_565_000, contractAmountValid: false }),
    ];
    const { items } = rankContractors(works, scopeOf, new Set(), { sort: 'contract', page: 0 });
    expect(items[0]).toEqual(
      expect.objectContaining({ ruc: '20100000001', obraCount: 3, totalContractAmount: 400, invalidContractCount: 1 }),
    );
    expect(items[1]).toEqual(expect.objectContaining({ ruc: 'C0000000002', invalidContractCount: 0 }));
  });

  it('pages', () => {
    expect(rankContractors(WORKS, scopeOf, new Set(), { sort: 'contract', page: 1, pageSize: 1 }).items.map((i) => i.ruc)).toEqual([
      'C0000000002',
    ]);
  });
});
