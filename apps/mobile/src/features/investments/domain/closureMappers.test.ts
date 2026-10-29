import { INVESTMENT_COLUMNS, STALLED_INVESTMENT_COLUMNS, mapInvestmentRow, mapMapPointRows } from './mappers';

const base = {
  cui: '2100997',
  name: 'FORTALECIMIENTO DE CAPACIDADES',
  entity: 'MUNICIPALIDAD DISTRITAL DE ACOBAMBILLA',
  status: 'CERRADO',
  situation: 'VIABLE',
  function: 'AGROPECUARIA',
  functional_division: 'PECUARIO',
  function_canonical: 'AGROPECUARIA',
  functional_group: 'INOCUIDAD PECUARIA',
  beneficiaries: 220,
  registered_at: '2009-07-17',
  viability_at: '2009-07-17',
  first_accrual_month: '2010-05-01',
  last_accrual_month: '2010-12-01',
  viable_amount: '101700',
  updated_cost: '101700',
  updated_cost_valid: true,
  spent_anomaly: false,
  accrued_total: '97418.7',
  cost_increase: '0',
  cost_increase_pct: '0',
  execution_progress: '0.958',
  department_code: 9,
  department_name: 'Huancavelica',
  source_updated_at: '2026-10-27T18:12:19+00:00',
  government_level: 'GL',
  data_source: 'open_data_closed',
};

describe('mapInvestmentRow closure facts', () => {
  it('maps the closure columns of a closed project, reading numeric strings', () => {
    const mapped = mapInvestmentRow({
      ...base,
      closed_at: '2019-11-29',
      closure_description: 'Sí, con liquidación',
      liquidation_amount: '100000.00',
      liquidated_at: '2015-05-19',
      culminated: true,
      physical_start_at: '2010-03-01',
      physical_end_at: '2010-11-30',
      operation_start_at: '2010-12-27',
    });

    expect(mapped.closure).toEqual({
      closedAt: '2019-11-29',
      description: 'Sí, con liquidación',
      liquidationAmount: 100000,
      liquidatedAt: '2015-05-19',
      culminated: true,
      physicalStartAt: '2010-03-01',
      physicalEndAt: '2010-11-30',
      operationStartAt: '2010-12-27',
    });
    expect(mapped.dataSource).toBe('open_data_closed');
  });

  it('has no closure when none of its columns has a value', () => {
    expect(mapInvestmentRow({ ...base, status: 'ACTIVO', data_source: 'open_data' }).closure).toBeNull();
    expect(
      mapInvestmentRow({ ...base, closed_at: null, culminated: null, liquidation_amount: null }).closure,
    ).toBeNull();
  });

  it('keeps a culminated = false and a zero liquidation', () => {
    expect(mapInvestmentRow({ ...base, culminated: false }).closure).toMatchObject({ culminated: false });
    expect(mapInvestmentRow({ ...base, liquidation_amount: 0 }).closure).toMatchObject({ liquidationAmount: 0 });
  });

  it('selects the closure columns from investments only (stalled projects are never closed)', () => {
    const columns = INVESTMENT_COLUMNS.split(',');
    for (const column of [
      'closed_at',
      'closure_description',
      'liquidation_amount',
      'liquidated_at',
      'culminated',
      'physical_start_at',
      'physical_end_at',
      'operation_start_at',
    ]) {
      expect(columns).toContain(column);
      expect(STALLED_INVESTMENT_COLUMNS.split(',')).not.toContain(column);
    }
  });
});

describe('mapMapPointRows status', () => {
  const point = {
    kind: 'point',
    cui: '2100997',
    name: 'FORTALECIMIENTO',
    latitude: -12.66,
    longitude: -75.32,
    point_count: 1,
    government_level: 'GL',
    cost_increase: '0',
    cost_increase_pct: '0',
    updated_cost_valid: true,
    total_cost_increase: null,
    max_cost_increase_pct: null,
    increased_count: null,
  };

  it('marks closed projects', () => {
    const result = mapMapPointRows([
      { ...point, status: 'CERRADO' },
      { ...point, cui: '2', status: 'ACTIVO' },
      { ...point, cui: '3' },
    ]);
    expect(result.kind === 'points' && result.points.map((p) => p.closed)).toEqual([true, false, false]);
  });
});
