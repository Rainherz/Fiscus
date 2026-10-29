import {
  COST_CHANGE_COLUMNS,
  INVESTMENT_COLUMNS,
  mapCostChangeRow,
  mapFunctionSummaryRow,
  mapIngestRunRow,
  mapInvestmentRow,
  mapRecentCostIncreaseRow,
  mapRegionComparisonRow,
  mapEntityComparisonRow,
  mapStalledInvestmentRow,
  mapMapPointRows,
  mapMapListRows,
  ENTITY_COMPARISON_COLUMNS,
  STALLED_INVESTMENT_COLUMNS,
} from './mappers';

const row = {
  cui: '2088142',
  name: 'MAJES SIGUAS II ETAPA',
  entity: 'GOBIERNO REGIONAL AREQUIPA',
  status: 'ACTIVO',
  situation: 'VIABLE',
  function: 'AGRARIA',
  functional_division: 'RIEGO',
  function_canonical: 'AGROPECUARIA',
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
      function: 'AGRARIA',
      functionCanonical: 'AGROPECUARIA',
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
      governmentLevel: null,
      executingUnit: null,
      province: null,
      district: null,
      physicalProgress: null,
      dataSource: 'ssi',
      coordinates: null,
      closure: null,
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

describe('mapInvestmentRow canonical function', () => {
  it('selects the canonical function from investments and stalled projects', () => {
    expect(INVESTMENT_COLUMNS.split(',')).toContain('function_canonical');
    expect(STALLED_INVESTMENT_COLUMNS.split(',')).toContain('function_canonical');
  });

  it('keeps a missing canonical function missing', () => {
    expect(mapInvestmentRow({ ...row, function: null, function_canonical: null }).functionCanonical).toBeNull();
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

  it('selects the investment columns the view has plus its derived columns', () => {
    const stalled = STALLED_INVESTMENT_COLUMNS.split(',');
    const shared = INVESTMENT_COLUMNS.split(',').filter(
      (c) =>
        ![
          'executing_unit',
          'province',
          'district',
          'data_source',
          'latitude',
          'longitude',
          'closed_at',
          'closure_description',
          'liquidation_amount',
          'liquidated_at',
          'culminated',
          'physical_start_at',
          'physical_end_at',
          'operation_start_at',
        ].includes(c),
    );
    expect(stalled).toEqual([...shared, 'months_without_accrual', 'pending_amount']);
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

describe('mapInvestmentRow levels and open data', () => {
  const local = {
    ...row,
    government_level: 'GL',
    executing_unit: 'MUNICIPALIDAD DISTRITAL DE CAYMA',
    province: 'AREQUIPA',
    district: 'CAYMA',
    physical_progress: '42.5',
    data_source: 'open_data',
  };

  it('maps the level, executing unit, location, physical progress and source', () => {
    expect(mapInvestmentRow(local)).toEqual(
      expect.objectContaining({
        governmentLevel: 'GL',
        executingUnit: 'MUNICIPALIDAD DISTRITAL DE CAYMA',
        province: 'AREQUIPA',
        district: 'CAYMA',
        physicalProgress: 42.5,
        dataSource: 'open_data',
      }),
    );
  });

  it('keeps a multi-department national project without department', () => {
    const mapped = mapInvestmentRow({ ...local, government_level: 'GN', department_code: null, department_name: null });
    expect(mapped.departmentCode).toBeNull();
    expect(mapped.governmentLevel).toBe('GN');
  });

  it('ignores unknown level and source codes', () => {
    const mapped = mapInvestmentRow({ ...local, government_level: 'XX', data_source: 'other' });
    expect(mapped.governmentLevel).toBeNull();
    expect(mapped.dataSource).toBe('ssi');
  });

  it('selects the new columns from investments, and only the view columns from stalled_investments_by_level', () => {
    const columns = INVESTMENT_COLUMNS.split(',');
    for (const column of ['government_level', 'executing_unit', 'province', 'district', 'physical_progress', 'data_source']) {
      expect(columns).toContain(column);
    }
    const stalled = STALLED_INVESTMENT_COLUMNS.split(',');
    expect(stalled).toEqual(expect.arrayContaining(['government_level', 'physical_progress', 'pending_amount']));
    expect(stalled).not.toContain('executing_unit');
    expect(stalled).not.toContain('data_source');
  });
});

describe('mapEntityComparisonRow', () => {
  it('maps an entity row and parses numeric strings', () => {
    expect(
      mapEntityComparisonRow({
        entity: 'MINISTERIO DE TRANSPORTES',
        government_level: 'GN',
        scope_department_code: 0,
        department_code: null,
        department_name: null,
        project_count: '3',
        valid_cost_count: 3,
        total_updated_cost: '4800000',
        total_cost_increase: '900000',
        projects_with_increase: 2,
        increased_viable_amount: '3000000',
        cost_increase_pct: '30',
        overspent_count: 1,
        stalled_count: 0,
        stalled_pending_amount: '0',
      }),
    ).toEqual({
      entity: 'MINISTERIO DE TRANSPORTES',
      governmentLevel: 'GN',
      departmentCode: null,
      departmentName: null,
      projectCount: 3,
      validCostCount: 3,
      totalUpdatedCost: 4_800_000,
      totalCostIncrease: 900_000,
      projectsWithIncrease: 2,
      increasedViableAmount: 3_000_000,
      costIncreasePct: 30,
      overspentCount: 1,
      stalledCount: 0,
      stalledPendingAmount: 0,
    });
    expect(ENTITY_COMPARISON_COLUMNS.split(',')).toContain('stalled_pending_amount');
  });
});

describe('mapInvestmentRow coordinates', () => {
  it('maps coordinates sent as numbers or strings', () => {
    expect(mapInvestmentRow({ ...row, latitude: '-16.3667', longitude: -71.55 }).coordinates).toEqual({
      latitude: -16.3667,
      longitude: -71.55,
    });
  });

  it('has no coordinates when either is missing', () => {
    expect(mapInvestmentRow(row).coordinates).toBeNull();
    expect(mapInvestmentRow({ ...row, latitude: -16.4, longitude: null }).coordinates).toBeNull();
  });

  it('selects the coordinates from investments only', () => {
    expect(INVESTMENT_COLUMNS.split(',')).toEqual(expect.arrayContaining(['latitude', 'longitude']));
    expect(STALLED_INVESTMENT_COLUMNS.split(',')).not.toContain('latitude');
  });
});

describe('mapMapPointRows', () => {
  const point = {
    kind: 'point',
    cui: '2088142',
    name: 'MAJES',
    latitude: -16.3,
    longitude: -72.1,
    point_count: 1,
    government_level: 'GR',
    cost_increase: '3809492486',
    cost_increase_pct: '284.6',
    updated_cost_valid: true,
    total_cost_increase: null,
    max_cost_increase_pct: null,
    increased_count: null,
  };
  const cluster = {
    ...point,
    kind: 'cluster',
    cui: null,
    name: null,
    point_count: 1250,
    government_level: null,
    cost_increase: null,
    cost_increase_pct: null,
    updated_cost_valid: null,
    total_cost_increase: '5000000',
    max_cost_increase_pct: '120.5',
    increased_count: 30,
  };

  it('maps project rows to points', () => {
    expect(mapMapPointRows([point])).toEqual({
      kind: 'points',
      points: [
        {
          cui: '2088142',
          name: 'MAJES',
          latitude: -16.3,
          longitude: -72.1,
          governmentLevel: 'GR',
          costIncrease: 3_809_492_486,
          costIncreasePct: 284.6,
          updatedCostValid: true,
          closed: false,
        },
      ],
    });
  });

  it('maps cluster rows to clusters', () => {
    expect(mapMapPointRows([cluster])).toEqual({
      kind: 'clusters',
      clusters: [
        {
          latitude: -16.3,
          longitude: -72.1,
          count: 1250,
          totalCostIncrease: 5_000_000,
          maxCostIncreasePct: 120.5,
          increasedCount: 30,
        },
      ],
    });
  });

  it('maps no rows to no points', () => {
    expect(mapMapPointRows([])).toEqual({ kind: 'points', points: [] });
  });

  it('drops rows without usable coordinates', () => {
    expect(mapMapPointRows([{ ...point, latitude: null }])).toEqual({ kind: 'points', points: [] });
  });
});

describe('mapMapListRows', () => {
  const row = {
    cui: '9900201',
    name: 'Pistas en Cayma',
    entity: 'MUNI CAYMA',
    government_level: 'GL',
    status: 'ACTIVO',
    latitude: -16.37,
    longitude: -71.55,
    updated_cost: '12900000',
    updated_cost_valid: true,
    accrued_total: '7869000',
    cost_increase: '4300000',
    cost_increase_pct: '50',
    execution_progress: '0.61',
    spent_anomaly: false,
    physical_progress: '42',
    last_accrual_month: '2026-10-01',
    stalled: false,
    total_count: '128',
  };

  it('maps rows to list items and reads the total from the window count', () => {
    expect(mapMapListRows([row])).toEqual({
      total: 128,
      items: [
        {
          cui: '9900201',
          name: 'Pistas en Cayma',
          entity: 'MUNI CAYMA',
          governmentLevel: 'GL',
          status: 'ACTIVO',
          latitude: -16.37,
          longitude: -71.55,
          updatedCost: 12_900_000,
          updatedCostValid: true,
          accruedTotal: 7_869_000,
          costIncrease: 4_300_000,
          costIncreasePct: 50,
          executionProgress: 0.61,
          spentAnomaly: false,
          physicalProgress: 42,
          lastAccrualMonth: '2026-10-01',
          stalled: false,
        },
      ],
    });
  });

  it('drops rows without coordinates or CUI and reads an empty page as zero', () => {
    expect(mapMapListRows([{ ...row, latitude: null }, { ...row, cui: null }])).toEqual({ total: 128, items: [] });
    expect(mapMapListRows([])).toEqual({ total: 0, items: [] });
  });
});
