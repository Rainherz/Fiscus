import {
  COST_CHANGE_COLUMNS,
  INVESTMENT_COLUMNS,
  mapCostChangeRow,
  mapFunctionSummaryRow,
  mapIngestRunRow,
  mapInvestmentRow,
  mapRecentCostIncreaseRow,
  mapRegionComparisonRow,
  mapStalledInvestmentRow,
  STALLED_INVESTMENT_COLUMNS,
} from './mappers';

const row = {
  cui: '2088142',
  name: 'MAJES SIGUAS II ETAPA',
  entity: 'GOBIERNO REGIONAL AREQUIPA',
  status: 'ACTIVO',
  situation: 'VIABLE',
  function: 'AGROPECUARIA',
  functional_division: 'RIEGO',
  functional_group: 'INFRAESTRUCTURA DE RIEGO',
  beneficiaries: 38500,
  registered_at: '2007-11-20',
  viability_at: '2008-01-10',
  first_accrual_month: '2009-03-01',
  last_accrual_month: '2026-09-01',
  viable_amount: '1338419640',
  updated_cost: 5147912126,
  updated_cost_valid: true,
  spent_anomaly: false,
  accrued_total: '926624182.68',
  cost_increase: '3809492486',
  cost_increase_pct: 284.6278,
  execution_progress: '0.18',
  department_code: 4,
  department_name: 'AREQUIPA',
  source_updated_at: '2026-10-25T10:00:00+00:00',
};

describe('mapInvestmentRow', () => {
  it('maps snake_case columns to the domain and parses numeric strings', () => {
    expect(mapInvestmentRow(row)).toEqual({
      cui: '2088142',
      name: 'MAJES SIGUAS II ETAPA',
      entity: 'GOBIERNO REGIONAL AREQUIPA',
      status: 'ACTIVO',
      situation: 'VIABLE',
      function: 'AGROPECUARIA',
      functionalDivision: 'RIEGO',
      functionalGroup: 'INFRAESTRUCTURA DE RIEGO',
      beneficiaries: 38500,
      registeredAt: '2007-11-20',
      viabilityAt: '2008-01-10',
      firstAccrualMonth: '2009-03-01',
      lastAccrualMonth: '2026-09-01',
      viableAmount: 1338419640,
      updatedCost: 5147912126,
      updatedCostValid: true,
      spentAnomaly: false,
      accruedTotal: 926624182.68,
      costIncrease: 3809492486,
      costIncreasePct: 284.6278,
      executionProgress: 0.18,
      departmentCode: 4,
      departmentName: 'AREQUIPA',
      sourceUpdatedAt: '2026-10-25T10:00:00+00:00',
    });
  });

  it('keeps missing values as null instead of coercing to 0', () => {
    const mapped = mapInvestmentRow({
      ...row,
      name: null,
      beneficiaries: null,
      viable_amount: null,
      execution_progress: '',
      cost_increase_pct: 'NaN',
    });
    expect(mapped.name).toBeNull();
    expect(mapped.beneficiaries).toBeNull();
    expect(mapped.viableAmount).toBeNull();
    expect(mapped.executionProgress).toBeNull();
    expect(mapped.costIncreasePct).toBeNull();
  });
});

describe('mapInvestmentRow cost validity', () => {
  it('flags an updated cost the source publishes as a placeholder', () => {
    const mapped = mapInvestmentRow({
      ...row,
      updated_cost: '10',
      updated_cost_valid: false,
      cost_increase: null,
      cost_increase_pct: null,
      execution_progress: null,
    });
    expect(mapped.updatedCost).toBe(10);
    expect(mapped.updatedCostValid).toBe(false);
  });

  it('treats a missing flag as not valid', () => {
    expect(mapInvestmentRow({ ...row, updated_cost_valid: null }).updatedCostValid).toBe(false);
  });

  it('selects the validity flag from the database', () => {
    expect(INVESTMENT_COLUMNS.split(',')).toContain('updated_cost_valid');
  });
});

describe('mapInvestmentRow spent anomaly', () => {
  it('maps the database flag for spending far above the updated cost', () => {
    expect(mapInvestmentRow({ ...row, spent_anomaly: true }).spentAnomaly).toBe(true);
  });

  it('treats a missing flag as no anomaly', () => {
    expect(mapInvestmentRow({ ...row, spent_anomaly: null }).spentAnomaly).toBe(false);
  });

  it('selects the anomaly flag from the database', () => {
    expect(INVESTMENT_COLUMNS.split(',')).toContain('spent_anomaly');
  });
});

describe('mapFunctionSummaryRow', () => {
  it('maps a per-department function summary', () => {
    expect(
      mapFunctionSummaryRow({
        department_code: 4,
        function: 'TRANSPORTE',
        investment_count: '120',
        total_updated_cost: '3000000000',
        total_cost_increase: null,
      }),
    ).toEqual({
      function: 'TRANSPORTE',
      investmentCount: 120,
      totalUpdatedCost: 3_000_000_000,
      totalCostIncrease: null,
    });
  });
});

describe('mapIngestRunRow', () => {
  it('maps the finish time', () => {
    expect(
      mapIngestRunRow({ started_at: '2026-10-26T05:00:00Z', finished_at: '2026-10-26T05:30:00Z' }),
    ).toEqual({ startedAt: '2026-10-26T05:00:00Z', finishedAt: '2026-10-26T05:30:00Z' });
  });
});

describe('mapCostChangeRow', () => {
  it('maps a cost change, reading PostgREST numeric strings', () => {
    expect(
      mapCostChangeRow({
        id: 7,
        cui: '2088142',
        change_kind: 'changed',
        observed_at: '2026-11-03T10:00:00+00:00',
        source_updated_at: '2026-11-03T05:00:00+00:00',
        previous_viable_amount: '1338419640',
        viable_amount: '1338419640',
        previous_updated_cost: '5101412126',
        updated_cost: '5145412126',
        accrued_total: null,
        updated_cost_delta: '44000000',
      }),
    ).toEqual({
      id: 7,
      cui: '2088142',
      kind: 'changed',
      observedAt: '2026-11-03T10:00:00+00:00',
      sourceUpdatedAt: '2026-11-03T05:00:00+00:00',
      previousViableAmount: 1_338_419_640,
      viableAmount: 1_338_419_640,
      previousUpdatedCost: 5_101_412_126,
      updatedCost: 5_145_412_126,
      accruedTotal: null,
      updatedCostDelta: 44_000_000,
    });
  });

  it('selects every column it maps', () => {
    expect(COST_CHANGE_COLUMNS.split(',')).toEqual(
      expect.arrayContaining(['id', 'cui', 'change_kind', 'observed_at', 'updated_cost_delta']),
    );
  });
});

describe('mapRecentCostIncreaseRow', () => {
  it('adds the embedded investment name', () => {
    const mapped = mapRecentCostIncreaseRow({
      id: 8,
      cui: '2088142',
      change_kind: 'changed',
      observed_at: '2026-11-03T10:00:00Z',
      source_updated_at: null,
      previous_viable_amount: null,
      viable_amount: null,
      previous_updated_cost: 1,
      updated_cost: 3,
      accrued_total: null,
      updated_cost_delta: 2,
      investments: { name: 'Majes Siguas II etapa', department_code: 4 },
    });
    expect(mapped.name).toBe('Majes Siguas II etapa');
    expect(mapped.updatedCostDelta).toBe(2);
  });

  it('keeps a missing investment name as null', () => {
    const mapped = mapRecentCostIncreaseRow({
      id: 9,
      cui: '1',
      change_kind: 'changed',
      observed_at: '2026-11-03T10:00:00Z',
      source_updated_at: null,
      previous_viable_amount: null,
      viable_amount: null,
      previous_updated_cost: 1,
      updated_cost: 3,
      accrued_total: null,
      updated_cost_delta: 2,
      investments: null,
    });
    expect(mapped.name).toBeNull();
  });
});

describe('mapStalledInvestmentRow', () => {
  it('maps the investment plus the months without accrual and the pending amount', () => {
    const stalled = mapStalledInvestmentRow({
      ...row,
      last_accrual_month: '2025-04-01',
      months_without_accrual: 18,
      pending_amount: '201960000.5',
    });
    expect(stalled).toEqual({
      ...mapInvestmentRow({ ...row, last_accrual_month: '2025-04-01' }),
      monthsWithoutAccrual: 18,
      pendingAmount: 201_960_000.5,
    });
  });

  it('selects the investment columns plus the derived view columns', () => {
    expect(STALLED_INVESTMENT_COLUMNS).toBe(`${INVESTMENT_COLUMNS},months_without_accrual,pending_amount`);
  });
});

describe('mapRegionComparisonRow', () => {
  it('parses numeric strings and keeps a null percentage', () => {
    expect(
      mapRegionComparisonRow({
        department_code: 2,
        department_name: null,
        project_count: '10',
        active_count: 9,
        valid_cost_count: 8,
        total_viable_amount: null,
        total_updated_cost: '5000000',
        total_cost_increase: '0',
        projects_with_increase: 0,
        cost_increase_pct: null,
        overspent_count: 0,
        stalled_count: '1',
        stalled_pending_amount: '250000',
      }),
    ).toEqual({
      departmentCode: 2,
      departmentName: null,
      projectCount: 10,
      activeCount: 9,
      validCostCount: 8,
      totalViableAmount: null,
      totalUpdatedCost: 5_000_000,
      totalCostIncrease: 0,
      projectsWithIncrease: 0,
      costIncreasePct: null,
      overspentCount: 0,
      stalledCount: 1,
      stalledPendingAmount: 250_000,
    });
  });
});
