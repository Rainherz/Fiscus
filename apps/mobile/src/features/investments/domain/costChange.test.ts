import { isCostIncrease, viableAmountChange, type CostChange } from './costChange';

const change: CostChange = {
  id: 1,
  cui: '2088142',
  kind: 'changed',
  observedAt: '2026-11-03T10:00:00Z',
  sourceUpdatedAt: null,
  previousViableAmount: 1_338_419_640,
  viableAmount: 1_338_419_640,
  previousUpdatedCost: 5_000_000_000,
  updatedCost: 5_040_000_000,
  accruedTotal: null,
  updatedCostDelta: 40_000_000,
};

describe('isCostIncrease', () => {
  it('is true only for recorded changes that raised the updated cost', () => {
    expect(isCostIncrease(change)).toBe(true);
    expect(isCostIncrease({ ...change, updatedCostDelta: -2_000_000 })).toBe(false);
    expect(isCostIncrease({ ...change, updatedCostDelta: 0 })).toBe(false);
    expect(isCostIncrease({ ...change, updatedCostDelta: null })).toBe(false);
    expect(isCostIncrease({ ...change, kind: 'baseline' })).toBe(false);
    expect(isCostIncrease({ ...change, kind: 'first_seen' })).toBe(false);
  });
});

describe('viableAmountChange', () => {
  it('returns both amounts when a recorded change modified the viable amount', () => {
    expect(viableAmountChange({ ...change, previousViableAmount: 1_300_000_000 })).toEqual({
      from: 1_300_000_000,
      to: 1_338_419_640,
    });
    expect(viableAmountChange({ ...change, previousViableAmount: null, viableAmount: 5 })).toEqual({
      from: null,
      to: 5,
    });
  });

  it('is null when the viable amount did not change or the row is not a change', () => {
    expect(viableAmountChange(change)).toBeNull();
    expect(viableAmountChange({ ...change, kind: 'baseline', previousViableAmount: null })).toBeNull();
  });
});
