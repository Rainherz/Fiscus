import { sampleRow } from '../adapters/sampleData';
import { computeEntityComparison } from './entityComparison';
import { mapInvestmentRow } from './mappers';
import { toStalledInvestment } from './stalled';

/** The rows of supabase/migrations/20261101000000_entity_comparison.sql's validation seed. */
const rows = [
  sampleRow({ cui: '1', entity: 'GR AREQUIPA', level: 'GR', viable: 100_000, updated: 150_000, progress: 0.1, lastAccrualMonth: '2026-09-01' }),
  sampleRow({ cui: '2', entity: 'GR AREQUIPA', level: 'GR', viable: 100_000, updated: 100_000, progress: 0.4, lastAccrualMonth: '2024-01-01' }),
  sampleRow({ cui: '3', entity: 'MTC', level: 'GN', viable: 1_000_000, updated: 1_300_000, accrued: 1_400_000, lastAccrualMonth: '2026-10-01' }),
  sampleRow({ cui: '4', entity: 'MTC', level: 'GN', viable: 1_000_000, updated: 900_000, progress: 0.11, departmentCode: 8, lastAccrualMonth: '2026-10-01' }),
  sampleRow({ cui: '5', entity: 'MTC', level: 'GN', viable: 2_000_000, updated: 2_600_000, progress: 0.08, departmentCode: null, departmentName: null }),
  sampleRow({ cui: '6', entity: 'MUNI', level: 'GL', viable: 500_000, updated: 700_000, progress: 0.14, departmentCode: 8 }),
  sampleRow({ cui: '7', entity: 'MUNI', level: 'GL', viable: 500_000, updated: 5, accrued: 1, departmentCode: 8 }),
  sampleRow({ cui: '8', entity: null, level: 'GL', viable: 1, updated: 2, departmentCode: 8 }),
].map(mapInvestmentRow);

const stalled = rows.flatMap((i) => toStalledInvestment(i, '2026-10-01') ?? []);

describe('computeEntityComparison', () => {
  it('has one row per entity and level nationwide, without entity-less projects', () => {
    const national = computeEntityComparison(rows, stalled);
    expect(national.map((e) => e.entity).sort()).toEqual(['GR AREQUIPA', 'MTC', 'MUNI']);
  });

  it('counts every project of a multi-department entity nationwide, with no department', () => {
    const mtc = computeEntityComparison(rows, stalled).find((e) => e.entity === 'MTC')!;
    expect(mtc).toEqual(
      expect.objectContaining({
        governmentLevel: 'GN',
        departmentCode: null,
        projectCount: 3,
        totalCostIncrease: 900_000,
        projectsWithIncrease: 2,
        increasedViableAmount: 3_000_000,
        costIncreasePct: 30,
        overspentCount: 1,
        totalUpdatedCost: 4_800_000,
        stalledCount: 0,
      }),
    );
  });

  it('keeps the department of an entity that works in one, and its stalled figures', () => {
    const gr = computeEntityComparison(rows, stalled).find((e) => e.entity === 'GR AREQUIPA')!;
    expect(gr).toEqual(
      expect.objectContaining({ departmentCode: 4, totalCostIncrease: 50_000, stalledCount: 1, stalledPendingAmount: 60_000 }),
    );
    const muni = computeEntityComparison(rows, stalled).find((e) => e.entity === 'MUNI')!;
    expect(muni).toEqual(expect.objectContaining({ validCostCount: 1, totalUpdatedCost: 700_000, totalCostIncrease: 200_000 }));
  });

  it('counts only the projects in a department for that department', () => {
    const cusco = computeEntityComparison(rows, stalled, 8);
    expect(cusco.map((e) => e.entity).sort()).toEqual(['MTC', 'MUNI']);
    expect(cusco.find((e) => e.entity === 'MTC')).toEqual(
      expect.objectContaining({ projectCount: 1, totalCostIncrease: 0, departmentCode: 8 }),
    );
  });
});
