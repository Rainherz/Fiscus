import { buildFunctionQuery, buildRankingQuery, buildSearchQuery } from '../domain/queries';
import { createInMemoryInvestmentsRepository } from './inMemoryInvestmentsRepository';
import { sampleRow } from './sampleData';

const rows = [
  sampleRow({ cui: '1', name: 'Hospital Norte', function: 'SALUD', viable: 100_000_000, updated: 150_000_000, progress: 0.5, viabilityAt: '2015-01-01' }),
  sampleRow({ cui: '2', name: 'Carretera Sur', function: 'TRANSPORTE', viable: 200_000_000, updated: 500_000_000, progress: 0.2, viabilityAt: '2010-01-01' }),
  sampleRow({ cui: '3', name: 'Posta pequeña', function: 'SALUD', viable: 100_000, updated: 900_000, progress: 1, viabilityAt: '2020-01-01' }),
  sampleRow({ cui: '4', name: 'Puente Lima', function: 'TRANSPORTE', viable: 50_000_000, updated: 40_000_000, progress: 0.9, viabilityAt: '2012-01-01', departmentCode: 15 }),
  sampleRow({ cui: '5', name: 'Sin función', function: null, viable: 10_000_000, updated: null, progress: null, viabilityAt: null }),
  sampleRow({ cui: '6', name: 'Costo de relleno', function: 'SALUD', viable: 166_262_211, updated: 10, accrued: 5_000_000, viabilityAt: '2009-01-01' }),
];

const repo = createInMemoryInvestmentsRepository({
  rows,
  lastRun: { startedAt: '2026-10-26T05:00:00Z', finishedAt: '2026-10-26T05:30:00Z' },
});

const cuis = (items: { cui: string }[]) => items.map((i) => i.cui);

describe('in-memory investments repository', () => {
  it('derives cost increase metrics like the database', async () => {
    const [carretera] = await repo.findMany(buildSearchQuery('2', 4)!);
    expect(carretera.costIncrease).toBe(300_000_000);
    expect(carretera.costIncreasePct).toBe(150);
    expect(carretera.accruedTotal).toBe(100_000_000);
    expect(carretera.executionProgress).toBeCloseTo(0.2);
  });

  it('derives null metrics and an invalid flag for placeholder costs, like the database', async () => {
    const placeholder = await repo.findByCui('6');
    expect(placeholder?.updatedCost).toBe(10);
    expect(placeholder?.updatedCostValid).toBe(false);
    expect(placeholder?.accruedTotal).toBe(5_000_000);
    expect(placeholder?.costIncrease).toBeNull();
    expect(placeholder?.costIncreasePct).toBeNull();
    expect(placeholder?.executionProgress).toBeNull();
    expect((await repo.findByCui('5'))?.updatedCostValid).toBe(false);
    expect((await repo.findByCui('1'))?.updatedCostValid).toBe(true);
  });

  it('keeps invalid source costs out of the cost ranking', async () => {
    const items = await repo.findMany(buildRankingQuery({ kind: 'cost', departmentCode: 4, page: 0 }));
    expect(cuis(items)).toEqual(['2', '1', '3']);
  });

  it('applies the increase ranking within the department', async () => {
    const items = await repo.findMany(buildRankingQuery({ kind: 'increase-amount', departmentCode: 4, page: 0 }));
    expect(cuis(items)).toEqual(['2', '1', '3']);
  });

  it('excludes tiny bases from the percentage ranking', async () => {
    const items = await repo.findMany(buildRankingQuery({ kind: 'increase-pct', departmentCode: 4, page: 0 }));
    expect(cuis(items)).toEqual(['2', '1']);
  });

  it('pages results', async () => {
    const items = await repo.findMany(buildRankingQuery({ kind: 'increase-amount', departmentCode: 4, page: 1, pageSize: 2 }));
    expect(cuis(items)).toEqual(['3']);
  });

  it('orders by oldest viability for the duration ranking', async () => {
    const items = await repo.findMany(buildRankingQuery({ kind: 'duration', departmentCode: 4, page: 0 }));
    expect(cuis(items)).toEqual(['6', '2', '1', '3']);
  });

  it('searches names case-insensitively', async () => {
    expect(cuis(await repo.findMany(buildSearchQuery('HOSPITAL', 4)!))).toEqual(['1']);
    expect(cuis(await repo.findMany(buildSearchQuery('puente', 4)!))).toEqual([]);
  });

  it('filters by function, including missing functions', async () => {
    expect(cuis(await repo.findMany(buildFunctionQuery({ departmentCode: 4, fn: 'SALUD', page: 0 })))).toEqual(['1', '3', '6']);
    expect(cuis(await repo.findMany(buildFunctionQuery({ departmentCode: 4, fn: null, page: 0 })))).toEqual(['5']);
  });

  it('finds by CUI', async () => {
    expect((await repo.findByCui('4'))?.name).toBe('Puente Lima');
    expect(await repo.findByCui('999')).toBeNull();
  });

  it('aggregates functions for a department, largest cost first', async () => {
    expect(await repo.functionSummaries(4)).toEqual([
      { function: 'TRANSPORTE', investmentCount: 1, totalUpdatedCost: 500_000_000, totalCostIncrease: 300_000_000 },
      { function: 'SALUD', investmentCount: 3, totalUpdatedCost: 150_900_010, totalCostIncrease: 50_800_000 },
      { function: null, investmentCount: 1, totalUpdatedCost: null, totalCostIncrease: null },
    ]);
  });

  it('returns the last ingest run', async () => {
    expect((await repo.lastIngestRun())?.finishedAt).toBe('2026-10-26T05:30:00Z');
  });
});
