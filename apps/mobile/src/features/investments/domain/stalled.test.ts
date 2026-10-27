import { sampleRow } from '../adapters/sampleData';
import { mapInvestmentRow } from './mappers';
import { monthsBetween, stalledStatus, toStalledInvestment } from './stalled';

const REFERENCE = '2026-10-01';

/** An active project that spent 32 % of S/ 297 M and last accrued in April 2025. */
const base = mapInvestmentRow(
  sampleRow({ cui: '1', viable: 297_000_000, updated: 297_000_000, progress: 0.32, lastAccrualMonth: '2025-04-01' }),
);

describe('monthsBetween', () => {
  it('counts whole calendar months between two month starts', () => {
    expect(monthsBetween('2025-04-01', REFERENCE)).toBe(18);
    expect(monthsBetween('2025-10-01', REFERENCE)).toBe(12);
    expect(monthsBetween(REFERENCE, REFERENCE)).toBe(0);
  });

  it('is null when a month is unknown', () => {
    expect(monthsBetween(null, REFERENCE)).toBeNull();
    expect(monthsBetween('2025-04-01', null)).toBeNull();
  });
});

describe('stalledStatus', () => {
  it('reports the last accrual month and the months without accrual', () => {
    expect(stalledStatus(base, REFERENCE)).toEqual({ since: '2025-04-01', months: 18 });
  });

  it('needs more than 12 months without accrual before the reference month', () => {
    expect(stalledStatus({ ...base, lastAccrualMonth: '2025-10-01' }, REFERENCE)).toBeNull();
    expect(stalledStatus({ ...base, lastAccrualMonth: '2025-09-01' }, REFERENCE)).toEqual({
      since: '2025-09-01',
      months: 13,
    });
  });

  it('only counts projects that spent between 5 % and 95 % of the cost, inclusive', () => {
    expect(stalledStatus({ ...base, executionProgress: 0.04 }, REFERENCE)).toBeNull();
    expect(stalledStatus({ ...base, executionProgress: 0.05 }, REFERENCE)).not.toBeNull();
    expect(stalledStatus({ ...base, executionProgress: 0.95 }, REFERENCE)).not.toBeNull();
    expect(stalledStatus({ ...base, executionProgress: 0.96 }, REFERENCE)).toBeNull();
    expect(stalledStatus({ ...base, executionProgress: null }, REFERENCE)).toBeNull();
  });

  it('ignores invalid costs, other statuses and unknown months', () => {
    expect(stalledStatus({ ...base, updatedCostValid: false }, REFERENCE)).toBeNull();
    expect(stalledStatus({ ...base, status: 'CERRADO' }, REFERENCE)).toBeNull();
    expect(stalledStatus({ ...base, status: null }, REFERENCE)).toBeNull();
    expect(stalledStatus({ ...base, lastAccrualMonth: null }, REFERENCE)).toBeNull();
    expect(stalledStatus(base, null)).toBeNull();
  });
});

describe('toStalledInvestment', () => {
  it('adds the months without accrual and the amount not yet spent', () => {
    expect(toStalledInvestment(base, REFERENCE)).toEqual({
      ...base,
      monthsWithoutAccrual: 18,
      pendingAmount: 297_000_000 - 0.32 * 297_000_000,
    });
  });

  it('is null when the project does not meet the rule', () => {
    expect(toStalledInvestment({ ...base, executionProgress: 0.99 }, REFERENCE)).toBeNull();
  });
});
