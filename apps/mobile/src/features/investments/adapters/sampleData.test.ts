import { mapCostChangeRow, mapInvestmentRow } from '../domain/mappers';
import { createInMemoryInvestmentsRepository } from './inMemoryInvestmentsRepository';
import { MOCK_COST_CHANGES, MOCK_PARALYZED_WORKS, MOCK_ROWS, sampleRow } from './sampleData';

const mock = MOCK_ROWS.map(mapInvestmentRow);

describe('sampleRow', () => {
  it('nulls the derived metrics for placeholder costs below S/ 1,000, like the database', () => {
    const row = sampleRow({ cui: '1', viable: 166_262_211, updated: 10, accrued: 5_000 });
    expect(row.updated_cost_valid).toBe(false);
    expect(row.cost_increase).toBeNull();
    expect(row.cost_increase_pct).toBeNull();
    expect(row.execution_progress).toBeNull();
    expect(row.accrued_total).toBe(5_000);
  });

  it('invalidates updated costs below 1% of a positive viable amount, like the database', () => {
    const row = sampleRow({ cui: '1', viable: 1_990_720, updated: 4_558.66, accrued: 1_422_564.44 });
    expect(row.updated_cost_valid).toBe(false);
    expect(row.cost_increase).toBeNull();
    expect(row.execution_progress).toBeNull();
    expect(row.spent_anomaly).toBe(false);
  });

  it('applies only the absolute floor when the viable amount is missing', () => {
    expect(sampleRow({ cui: '1', viable: null, updated: 5_000 }).updated_cost_valid).toBe(true);
  });

  it('flags spending above 10 times a valid updated cost, like the database', () => {
    expect(sampleRow({ cui: '1', viable: 299_700, updated: 299_700, accrued: 18_768_455.33 }).spent_anomaly).toBe(true);
    expect(sampleRow({ cui: '2', viable: 1_000_000, updated: 1_000_000, accrued: 10_000_000 }).spent_anomaly).toBe(false);
    expect(sampleRow({ cui: '3', viable: 1_000_000, updated: 1_000_000, accrued: null }).spent_anomaly).toBe(false);
  });

  it('derives the canonical function from the function and division, like the database trigger', () => {
    const row = sampleRow({ cui: '1', function: 'SALUD Y SANEAMIENTO', division: 'SANEAMIENTO' });
    expect(row.function).toBe('SALUD Y SANEAMIENTO');
    expect(row.functional_division).toBe('SANEAMIENTO');
    expect(row.function_canonical).toBe('SANEAMIENTO');
    expect(sampleRow({ cui: '2', function: 'TRANSPORTE' }).function_canonical).toBe('TRANSPORTE');
    expect(sampleRow({ cui: '3' }).function_canonical).toBeNull();
  });

  it('keeps an explicit null name, status and department name', () => {
    const row = sampleRow({ cui: '1', name: null, status: null, departmentName: null });
    expect(row.status).toBeNull();
    expect(row.name).toBeNull();
    expect(row.department_name).toBeNull();
  });
});

describe('MOCK_ROWS', () => {
  it('includes projects of the old functional classification', () => {
    const old = mock.filter((i) => i.function !== i.functionCanonical);
    expect(old.map((i) => [i.function, i.functionalDivision, i.functionCanonical])).toEqual(
      expect.arrayContaining([
        ['EDUCACION Y CULTURA', 'INFRAESTRUCTURA EDUCATIVA', 'EDUCACIÓN'],
        ['SALUD Y SANEAMIENTO', 'SANEAMIENTO', 'SANEAMIENTO'],
      ]),
    );
  });

  it('includes a project that spent more than its updated cost', () => {
    const lorena = mock.find((i) => i.cui === '2094808');
    expect(lorena?.updatedCostValid).toBe(true);
    expect(lorena?.executionProgress).toBeGreaterThan(1);
  });

  it('includes a project whose source cost is a placeholder', () => {
    const placeholder = mock.find((i) => i.cui === '2196297');
    expect(placeholder?.updatedCost).toBe(10);
    expect(placeholder?.updatedCostValid).toBe(false);
  });

  it('includes a project whose updated cost is below 1% of its viable amount', () => {
    const truncated = mock.find((i) => i.cui === '2045951');
    expect(truncated?.updatedCost).toBe(4_558.66);
    expect(truncated?.updatedCostValid).toBe(false);
    expect(truncated?.executionProgress).toBeNull();
  });

  it('includes a project whose spending is unusually high for its updated cost', () => {
    const anomaly = mock.find((i) => i.cui === '2057689');
    expect(anomaly?.updatedCostValid).toBe(true);
    expect(anomaly?.spentAnomaly).toBe(true);
    expect(anomaly?.executionProgress).toBeCloseTo(62.62, 2);
  });

  it('includes Arequipa projects without recent spending for the demo mode', async () => {
    const repo = createInMemoryInvestmentsRepository({ rows: MOCK_ROWS, lastRun: null });
    expect(await repo.getAccrualReferenceMonth()).toBe('2026-10-01');
    const stalled = await repo.getStalledInvestments({ departmentCode: 4, page: 0 });
    expect(stalled.length).toBeGreaterThanOrEqual(2);
    expect(stalled.length).toBeLessThanOrEqual(3);
    expect(await repo.countStalledInvestments(4)).toBe(stalled.length);
  });

  it('includes demo national and local projects, one national without department', () => {
    const levels = MOCK_ROWS.filter((r) => r.government_level !== 'GR');
    expect(levels.length).toBeGreaterThanOrEqual(4);
    for (const row of levels) expect(row.name).toMatch(/\(demo\)$/);
    expect(mock.some((i) => i.governmentLevel === 'GN' && i.departmentCode === null)).toBe(true);
    const local = MOCK_ROWS.find((r) => r.government_level === 'GL' && r.physical_progress !== null);
    expect(local).toEqual(
      expect.objectContaining({ latitude: expect.any(Number), longitude: expect.any(Number), data_source: 'open_data' }),
    );
  });

  it('places most demo rows on the map, inside Peru, but not every one', () => {
    const located = MOCK_ROWS.filter((r) => r.latitude !== null && r.longitude !== null);
    expect(located.length).toBeGreaterThanOrEqual(MOCK_ROWS.length - 3);
    expect(located.length).toBeLessThan(MOCK_ROWS.length);
    for (const row of located) {
      expect(row.latitude).toBeGreaterThanOrEqual(-19);
      expect(row.latitude).toBeLessThan(0);
      expect(row.longitude).toBeGreaterThanOrEqual(-82);
      expect(row.longitude).toBeLessThanOrEqual(-68);
    }
    // A national project spanning several departments has no single location.
    expect(MOCK_ROWS.find((r) => r.department_code === null)?.latitude).toBeNull();
  });

  it('gives the demo entities more than one project, for the entity ranking and its drill-down', async () => {
    const repo = createInMemoryInvestmentsRepository({ rows: MOCK_ROWS, lastRun: null });
    const entities = await repo.getEntityComparison({ sort: 'increase-amount', page: 0 });
    expect(entities.some((e) => e.governmentLevel === 'GN' && e.projectCount >= 2 && e.departmentCode === null)).toBe(true);
    expect(entities.some((e) => e.governmentLevel === 'GL')).toBe(true);
  });

  it('has unique CUIs', () => {
    expect(new Set(mock.map((i) => i.cui)).size).toBe(mock.length);
  });
});

describe('MOCK_COST_CHANGES', () => {
  const changes = MOCK_COST_CHANGES.map(mapCostChangeRow);
  const majesHistory = changes.filter((c) => c.cui === '2088142');

  it('starts every mock investment with a baseline on the first day of the record', () => {
    for (const row of MOCK_ROWS) {
      const baselines = changes.filter((c) => c.cui === row.cui && c.kind === 'baseline');
      expect(baselines).toHaveLength(1);
      expect(baselines[0].observedAt.startsWith('2026-10-27')).toBe(true);
    }
  });

  it('gives Majes Siguas II two later increases that end at its current values', () => {
    expect(majesHistory.map((c) => c.kind)).toEqual(['baseline', 'changed', 'changed']);
    const [, first, second] = majesHistory;
    expect(first.updatedCostDelta).toBeGreaterThan(0);
    expect(second.updatedCostDelta).toBeGreaterThan(0);
    expect(first.previousUpdatedCost).toBe(majesHistory[0].updatedCost);
    expect(second.previousUpdatedCost).toBe(first.updatedCost);
    const majes = MOCK_ROWS.find((r) => r.cui === '2088142')!;
    expect(second.updatedCost).toBe(majes.updated_cost);
    expect(second.viableAmount).toBe(majes.viable_amount);
  });

  it('derives the delta the way the generated column does', () => {
    for (const c of changes) {
      const expected =
        c.updatedCost !== null && c.previousUpdatedCost !== null ? c.updatedCost - c.previousUpdatedCost : null;
      expect(c.updatedCostDelta).toBe(expected);
    }
  });

  it('keeps baselines equal to the current values when nothing changed later', () => {
    const uchumayo = changes.filter((c) => c.cui === '2178454');
    expect(uchumayo).toHaveLength(1);
    expect(uchumayo[0].updatedCost).toBe(MOCK_ROWS.find((r) => r.cui === '2178454')!.updated_cost);
  });

  it('has unique ids', () => {
    expect(new Set(changes.map((c) => c.id)).size).toBe(changes.length);
  });
});

describe('MOCK_PARALYZED_WORKS', () => {
  it('links every demo obra to a demo project, with unique INFOBRAS codes', () => {
    const cuis = new Set(MOCK_ROWS.map((r) => r.cui));
    for (const work of MOCK_PARALYZED_WORKS) expect([work.cui, cuis.has(work.cui!)]).toEqual([work.cui, true]);
    expect(new Set(MOCK_PARALYZED_WORKS.map((w) => w.infobrasCode)).size).toBe(MOCK_PARALYZED_WORKS.length);
    expect(MOCK_PARALYZED_WORKS.every((w) => w.obraDescription?.endsWith('(demo)'))).toBe(true);
  });

  it('includes a project that is both paralyzed and without recent spending, with two obras', async () => {
    const repo = createInMemoryInvestmentsRepository({ rows: MOCK_ROWS, lastRun: null, paralyzedWorks: MOCK_PARALYZED_WORKS });
    const detail = await repo.getParalyzedDetail('9900001');
    expect(detail?.works).toHaveLength(2);
    const stalled = await repo.getStalledInvestments({ page: 0 });
    expect(stalled.map((s) => s.cui)).toContain('9900001');
    // The closed one only counts with every status.
    expect(await repo.countParalyzedInvestments(undefined, 'ALL', 'ACTIVE')).toBe(4);
    expect(await repo.countParalyzedInvestments(undefined, 'ALL', 'ALL')).toBe(5);
  });
});
