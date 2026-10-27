import { INVESTMENT_COLUMNS, mapFunctionSummaryRow, mapIngestRunRow, mapInvestmentRow } from './mappers';

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
