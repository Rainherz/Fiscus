import { sampleRow } from '../adapters/sampleData';
import { mapInvestmentRow } from './mappers';
import { REGION_SORTS, computeRegionComparison, rankRegions, type RegionComparison } from './regionComparison';
import { toStalledInvestment } from './stalled';

const REFERENCE = '2026-10-01';

const investments = [
  sampleRow({ cui: 'a1', viable: 1_000_000, updated: 1_500_000, progress: 0.5, lastAccrualMonth: '2026-09-01', departmentCode: 1, departmentName: 'AMAZONAS' }),
  // Reduction: excluded from the increase total, but overspent (accrued above the updated cost).
  sampleRow({ cui: 'a2', viable: 2_000_000, updated: 1_800_000, accrued: 2_000_000, lastAccrualMonth: REFERENCE, departmentCode: 1, departmentName: 'AMAZONAS' }),
  // Placeholder cost: excluded from every cost figure.
  sampleRow({ cui: 'a3', viable: 1_000_000, updated: 10, accrued: 500, lastAccrualMonth: REFERENCE, departmentCode: 1, departmentName: 'AMAZONAS' }),
  // Stalled: 30 % spent, no accrual since January 2024.
  sampleRow({ cui: 'a4', viable: 500_000, updated: 1_000_000, progress: 0.3, lastAccrualMonth: '2024-01-01', departmentCode: 1, departmentName: 'AMAZONAS' }),
  sampleRow({ cui: 'a5', viable: 100_000, updated: null, status: 'CERRADO', departmentCode: 1, departmentName: 'AMAZONAS' }),
  sampleRow({ cui: 'b1', viable: 1_000_000, updated: 1_000_000, progress: 1, lastAccrualMonth: REFERENCE, departmentCode: 2, departmentName: 'ANCASH' }),
  sampleRow({ cui: 'c1', viable: 1_000_000, updated: 3_000_000, accrued: 3_500_000, lastAccrualMonth: REFERENCE, departmentCode: 3, departmentName: null }),
  sampleRow({ cui: 'c2', viable: 1_000_000, updated: null, departmentCode: 3, departmentName: 'APURIMAC' }),
].map(mapInvestmentRow);

const stalled = investments.flatMap((i) => toStalledInvestment(i, REFERENCE) ?? []);

describe('computeRegionComparison', () => {
  const [amazonas, ancash, apurimac] = computeRegionComparison(investments, stalled);

  it('returns one row per department, ordered by department code, like the view', () => {
    expect(computeRegionComparison(investments, stalled).map((r) => r.departmentCode)).toEqual([1, 2, 3]);
    expect(apurimac.departmentName).toBe('APURIMAC');
  });

  it('counts projects and aggregates valid updated costs only', () => {
    expect(amazonas).toEqual({
      departmentCode: 1,
      departmentName: 'AMAZONAS',
      projectCount: 5,
      activeCount: 4,
      validCostCount: 3,
      totalViableAmount: 3_500_000,
      totalUpdatedCost: 4_300_000,
      totalCostIncrease: 1_000_000,
      projectsWithIncrease: 2,
      costIncreasePct: expect.closeTo(66.667, 2),
      overspentCount: 1,
      stalledCount: 1,
      stalledPendingAmount: 700_000,
    });
  });

  it('reports zero increases and a null percentage without increases', () => {
    expect(ancash).toMatchObject({
      totalCostIncrease: 0,
      projectsWithIncrease: 0,
      costIncreasePct: null,
      overspentCount: 0,
      stalledCount: 0,
      stalledPendingAmount: 0,
    });
  });

  it('computes the percentage over the viable amount of the projects with an increase', () => {
    expect(apurimac).toMatchObject({ totalCostIncrease: 2_000_000, costIncreasePct: 200, overspentCount: 1 });
  });
});

function region(code: number, values: Partial<RegionComparison>): RegionComparison {
  return {
    departmentCode: code,
    departmentName: null,
    projectCount: 0,
    activeCount: 0,
    validCostCount: 0,
    totalViableAmount: null,
    totalUpdatedCost: null,
    totalCostIncrease: 0,
    projectsWithIncrease: 0,
    costIncreasePct: null,
    overspentCount: 0,
    stalledCount: 0,
    stalledPendingAmount: 0,
    ...values,
  };
}

describe('rankRegions', () => {
  const regions = [
    region(1, { totalCostIncrease: 100, costIncreasePct: null, stalledCount: 3, stalledPendingAmount: 10, overspentCount: 2 }),
    region(2, { totalCostIncrease: 300, costIncreasePct: 20, stalledCount: 3, stalledPendingAmount: 50, overspentCount: 2 }),
    region(3, { totalCostIncrease: 200, costIncreasePct: 45, stalledCount: 9, stalledPendingAmount: 0, overspentCount: 7 }),
  ];
  const codes = (sort: (typeof REGION_SORTS)[number]) => rankRegions(regions, sort).map((r) => r.departmentCode);

  it('has four sorts', () => {
    expect(REGION_SORTS).toEqual(['increase-amount', 'increase-pct', 'stalled', 'overspent']);
  });

  it('ranks by the total increase in soles', () => {
    expect(codes('increase-amount')).toEqual([2, 3, 1]);
  });

  it('ranks by the percentage, nulls last', () => {
    expect(codes('increase-pct')).toEqual([3, 2, 1]);
  });

  it('ranks by stalled projects, then by the amount not yet spent', () => {
    expect(codes('stalled')).toEqual([3, 2, 1]);
  });

  it('ranks by overspent projects, then by department code', () => {
    expect(codes('overspent')).toEqual([3, 1, 2]);
  });

  it('does not mutate its input', () => {
    rankRegions(regions, 'increase-amount');
    expect(regions.map((r) => r.departmentCode)).toEqual([1, 2, 3]);
  });
});
