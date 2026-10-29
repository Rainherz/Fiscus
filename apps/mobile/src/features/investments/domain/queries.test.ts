import {
  PAGE_SIZE,
  PCT_RANKING_MIN_VIABLE_AMOUNT,
  buildFunctionQuery,
  buildRankingQuery,
  buildSearchQuery,
  buildEntityQuery,
  buildStalledQuery,
} from './queries';

describe('buildRankingQuery', () => {
  it('ranks by absolute cost increase within the department, only real increases', () => {
    expect(buildRankingQuery({ kind: 'increase-amount', departmentCode: 4, page: 0 })).toEqual({
      filters: [
        { column: 'department_code', op: 'eq', value: 4 },
        { column: 'updated_cost_valid', op: 'eq', value: true },
        { column: 'cost_increase', op: 'gt', value: 0 },
      ],
      order: [
        { column: 'cost_increase', ascending: false },
        { column: 'cui', ascending: true },
      ],
      range: { from: 0, to: 29 },
    });
  });

  it('excludes tiny approved amounts from the percentage ranking', () => {
    const query = buildRankingQuery({ kind: 'increase-pct', departmentCode: 4, page: 0 });
    expect(PCT_RANKING_MIN_VIABLE_AMOUNT).toBe(1_000_000);
    expect(query.filters).toEqual([
      { column: 'department_code', op: 'eq', value: 4 },
      { column: 'updated_cost_valid', op: 'eq', value: true },
      { column: 'viable_amount', op: 'gte', value: 1_000_000 },
      { column: 'cost_increase_pct', op: 'gt', value: 0 },
    ]);
    expect(query.order[0]).toEqual({ column: 'cost_increase_pct', ascending: false });
  });

  it('ranks by current cost, skipping invalid source costs', () => {
    const query = buildRankingQuery({ kind: 'cost', departmentCode: 15, page: 0 });
    expect(query.filters).toEqual([
      { column: 'department_code', op: 'eq', value: 15 },
      { column: 'updated_cost_valid', op: 'eq', value: true },
    ]);
    expect(query.order[0]).toEqual({ column: 'updated_cost', ascending: false });
  });

  it('ranks active projects by oldest viability date', () => {
    const query = buildRankingQuery({ kind: 'duration', departmentCode: 4, page: 0 });
    expect(query.filters).toEqual([
      { column: 'department_code', op: 'eq', value: 4 },
      { column: 'status', op: 'eq', value: 'ACTIVO' },
      { column: 'viability_at', op: 'notNull' },
    ]);
    expect(query.order[0]).toEqual({ column: 'viability_at', ascending: true });
  });

  it('pages in blocks of 30', () => {
    expect(PAGE_SIZE).toBe(30);
    expect(buildRankingQuery({ kind: 'cost', departmentCode: 4, page: 2 }).range).toEqual({
      from: 60,
      to: 89,
    });
  });

  it('accepts a custom page size', () => {
    expect(
      buildRankingQuery({ kind: 'cost', departmentCode: 4, page: 0, pageSize: 6 }).range,
    ).toEqual({ from: 0, to: 5 });
  });
});

describe('national ranking queries', () => {
  it('omits the department filter for all of Peru', () => {
    expect(buildRankingQuery({ kind: 'increase-amount', page: 0, pageSize: 6 })).toEqual({
      filters: [
        { column: 'updated_cost_valid', op: 'eq', value: true },
        { column: 'cost_increase', op: 'gt', value: 0 },
      ],
      order: [
        { column: 'cost_increase', ascending: false },
        { column: 'cui', ascending: true },
      ],
      range: { from: 0, to: 5 },
    });
  });

  it('keeps every national ranking paged', () => {
    for (const kind of ['increase-amount', 'increase-pct', 'cost', 'duration'] as const) {
      const query = buildRankingQuery({ kind, departmentCode: undefined, page: 3 });
      expect(query.filters.some((f) => f.column === 'department_code')).toBe(false);
      expect(query.range).toEqual({ from: 90, to: 119 });
    }
  });
});

describe('buildSearchQuery', () => {
  it('returns null for blank or too-short text', () => {
    expect(buildSearchQuery('', 4)).toBeNull();
    expect(buildSearchQuery('  ', 4)).toBeNull();
    expect(buildSearchQuery('ab', 4)).toBeNull();
  });

  it('treats digits as an exact CUI across all departments', () => {
    expect(buildSearchQuery(' 2088142 ', 4)).toEqual({
      filters: [{ column: 'cui', op: 'eq', value: '2088142' }],
      order: [{ column: 'cui', ascending: true }],
      range: { from: 0, to: 29 },
    });
  });

  it('searches names case-insensitively within the department', () => {
    expect(buildSearchQuery('  hospital   regional ', 4)).toEqual({
      filters: [
        { column: 'department_code', op: 'eq', value: 4 },
        { column: 'name', op: 'ilike', value: '%hospital regional%' },
      ],
      order: [
        { column: 'updated_cost', ascending: false },
        { column: 'cui', ascending: true },
      ],
      range: { from: 0, to: 29 },
    });
  });

  it('searches names in all of Peru without a department', () => {
    expect(buildSearchQuery('hospital', undefined)).toEqual({
      filters: [{ column: 'name', op: 'ilike', value: '%hospital%' }],
      order: [
        { column: 'updated_cost', ascending: false },
        { column: 'cui', ascending: true },
      ],
      range: { from: 0, to: 29 },
    });
    expect(buildSearchQuery('2088142', undefined)?.filters).toEqual([{ column: 'cui', op: 'eq', value: '2088142' }]);
  });

  it('escapes LIKE wildcards typed by the user', () => {
    const query = buildSearchQuery('100%_obra\\', 4);
    expect(query?.filters[1]).toEqual({
      column: 'name',
      op: 'ilike',
      value: '%100\\%\\_obra\\\\%',
    });
  });
});

describe('buildFunctionQuery', () => {
  it('lists a function within the department by current cost', () => {
    expect(buildFunctionQuery({ departmentCode: 4, fn: 'TRANSPORTE', page: 1 })).toEqual({
      filters: [
        { column: 'department_code', op: 'eq', value: 4 },
        { column: 'function_canonical', op: 'eq', value: 'TRANSPORTE' },
      ],
      order: [
        { column: 'updated_cost', ascending: false },
        { column: 'cui', ascending: true },
      ],
      range: { from: 30, to: 59 },
    });
  });

  it('matches projects without a function', () => {
    const query = buildFunctionQuery({ departmentCode: 4, fn: null, page: 0 });
    expect(query.filters[1]).toEqual({ column: 'function_canonical', op: 'isNull' });
  });
});

describe('national function and stalled queries', () => {
  it('lists a function in all of Peru, paged', () => {
    expect(buildFunctionQuery({ fn: 'SALUD', page: 0 })).toEqual({
      filters: [{ column: 'function_canonical', op: 'eq', value: 'SALUD' }],
      order: [
        { column: 'updated_cost', ascending: false },
        { column: 'cui', ascending: true },
      ],
      range: { from: 0, to: 29 },
    });
  });

  it('lists stalled projects in all of Peru, paged', () => {
    expect(buildStalledQuery({ page: 0, pageSize: 3 })).toEqual({
      filters: [],
      order: [
        { column: 'pending_amount', ascending: false },
        { column: 'cui', ascending: true },
      ],
      range: { from: 0, to: 2 },
    });
  });
});

describe('buildStalledQuery', () => {
  it('lists the department by the amount not yet spent, largest first', () => {
    expect(buildStalledQuery({ departmentCode: 21, page: 1 })).toEqual({
      filters: [{ column: 'department_code', op: 'eq', value: 21 }],
      order: [
        { column: 'pending_amount', ascending: false },
        { column: 'cui', ascending: true },
      ],
      range: { from: PAGE_SIZE, to: 2 * PAGE_SIZE - 1 },
    });
  });

  it('accepts a page size for short previews', () => {
    expect(buildStalledQuery({ departmentCode: 4, page: 0, pageSize: 3 }).range).toEqual({ from: 0, to: 2 });
  });
});

describe('government level filter', () => {
  const level = { column: 'government_level', op: 'eq', value: 'GL' };

  it('adds no level filter for every level', () => {
    for (const query of [
      buildRankingQuery({ kind: 'cost', level: 'ALL', page: 0 }),
      buildSearchQuery('hospital', undefined, 'ALL')!,
      buildFunctionQuery({ fn: 'SALUD', level: 'ALL', page: 0 }),
      buildStalledQuery({ level: 'ALL', page: 0 }),
    ]) {
      expect(query.filters.some((f) => f.column === 'government_level')).toBe(false);
    }
  });

  it('filters rankings, name searches, functions and stalled lists by one level after the department', () => {
    expect(buildRankingQuery({ kind: 'cost', departmentCode: 4, level: 'GL', page: 0 }).filters).toEqual([
      { column: 'department_code', op: 'eq', value: 4 },
      level,
      { column: 'updated_cost_valid', op: 'eq', value: true },
    ]);
    expect(buildSearchQuery('hospital', 4, 'GL')!.filters.slice(0, 2)).toEqual([
      { column: 'department_code', op: 'eq', value: 4 },
      level,
    ]);
    expect(buildFunctionQuery({ fn: 'SALUD', level: 'GL', page: 0 }).filters[0]).toEqual(level);
    expect(buildStalledQuery({ level: 'GL', page: 0 }).filters).toEqual([level]);
  });

  it('looks up an exact CUI at every level, like in every department', () => {
    expect(buildSearchQuery('2088142', 4, 'GN')?.filters).toEqual([{ column: 'cui', op: 'eq', value: '2088142' }]);
  });

  it('limits rankings and stalled lists to one entity of a level', () => {
    expect(
      buildRankingQuery({ kind: 'increase-amount', level: 'GN', entity: 'MINISTERIO DE SALUD', page: 0 }).filters.slice(0, 2),
    ).toEqual([
      { column: 'government_level', op: 'eq', value: 'GN' },
      { column: 'entity', op: 'eq', value: 'MINISTERIO DE SALUD' },
    ]);
    expect(buildStalledQuery({ departmentCode: 8, level: 'GL', entity: 'MUNI', page: 0 }).filters).toEqual([
      { column: 'department_code', op: 'eq', value: 8 },
      { column: 'government_level', op: 'eq', value: 'GL' },
      { column: 'entity', op: 'eq', value: 'MUNI' },
    ]);
  });
});

describe('buildEntityQuery', () => {
  const tieBreak = [
    { column: 'entity', ascending: true },
    { column: 'government_level', ascending: true },
  ];

  it('ranks entities of all of Peru by total increase, only entities with increases', () => {
    expect(buildEntityQuery({ sort: 'increase-amount', level: 'ALL', page: 0 })).toEqual({
      filters: [
        { column: 'scope_department_code', op: 'eq', value: 0 },
        { column: 'total_cost_increase', op: 'gt', value: 0 },
      ],
      order: [{ column: 'total_cost_increase', ascending: false }, ...tieBreak],
      range: { from: 0, to: 29 },
    });
  });

  it('reads the department rows and one level', () => {
    expect(buildEntityQuery({ sort: 'overspent', departmentCode: 4, level: 'GL', page: 1 })).toEqual({
      filters: [
        { column: 'scope_department_code', op: 'eq', value: 4 },
        { column: 'government_level', op: 'eq', value: 'GL' },
        { column: 'overspent_count', op: 'gt', value: 0 },
      ],
      order: [{ column: 'overspent_count', ascending: false }, ...tieBreak],
      range: { from: 30, to: 59 },
    });
  });

  it('ranks percentages only over increases on more than S/ 1 M approved', () => {
    const query = buildEntityQuery({ sort: 'increase-pct', level: 'ALL', page: 0 });
    expect(query.filters.slice(1)).toEqual([
      { column: 'increased_viable_amount', op: 'gte', value: PCT_RANKING_MIN_VIABLE_AMOUNT },
      { column: 'cost_increase_pct', op: 'gt', value: 0 },
    ]);
    expect(query.order[0]).toEqual({ column: 'cost_increase_pct', ascending: false });
  });

  it('ranks stalled projects by count, then by the amount not yet spent', () => {
    const query = buildEntityQuery({ sort: 'stalled', level: 'ALL', page: 0 });
    expect(query.filters[1]).toEqual({ column: 'stalled_count', op: 'gt', value: 0 });
    expect(query.order.slice(0, 2)).toEqual([
      { column: 'stalled_count', ascending: false },
      { column: 'stalled_pending_amount', ascending: false },
    ]);
  });
});
