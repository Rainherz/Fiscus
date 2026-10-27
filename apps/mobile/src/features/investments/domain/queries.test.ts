import {
  PAGE_SIZE,
  PCT_RANKING_MIN_VIABLE_AMOUNT,
  buildFunctionQuery,
  buildRankingQuery,
  buildSearchQuery,
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
        { column: 'function', op: 'eq', value: 'TRANSPORTE' },
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
    expect(query.filters[1]).toEqual({ column: 'function', op: 'isNull' });
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
