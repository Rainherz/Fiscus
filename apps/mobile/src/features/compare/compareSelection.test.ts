import { department, NATIONAL } from '@/features/department/scope';
import { regionRow } from '@/test/regionComparison';

import { compareHref, needsComparisonData, parseRegionCode, resolvePair, swapPair } from './compareSelection';

const regions = [
  regionRow(8, { totalCostIncrease: 1_200_000_000 }),
  regionRow(4, { totalCostIncrease: 3_809_492_486 }),
  regionRow(13, { totalCostIncrease: 2_000_000_000 }),
];

describe('parseRegionCode', () => {
  it('reads a known department code', () => {
    expect(parseRegionCode('4')).toBe(4);
    expect(parseRegionCode('25')).toBe(25);
  });

  it('rejects missing, unknown and malformed codes', () => {
    for (const raw of [undefined, '', '0', '26', '-4', '4.5', 'abc', '4x', ' 4', '04 ']) {
      expect(parseRegionCode(raw)).toBeNull();
    }
  });

  it('uses the first value when the parameter is repeated', () => {
    expect(parseRegionCode(['8', '4'])).toBe(8);
  });
});

describe('resolvePair', () => {
  it('keeps two valid codes from the URL', () => {
    expect(resolvePair({ a: 13, b: 8, scope: department(4), regions })).toEqual({ a: 13, b: 8 });
  });

  it('keeps the same region twice when the URL says so', () => {
    expect(resolvePair({ a: 8, b: 8, scope: NATIONAL, regions })).toEqual({ a: 8, b: 8 });
  });

  it('defaults to the two regions with the largest total increase for all of Peru', () => {
    expect(resolvePair({ a: null, b: null, scope: NATIONAL, regions })).toEqual({ a: 4, b: 13 });
  });

  it('starts with the current region, then the largest increase that is not it', () => {
    expect(resolvePair({ a: null, b: null, scope: department(8), regions })).toEqual({ a: 8, b: 4 });
    expect(resolvePair({ a: null, b: null, scope: department(4), regions })).toEqual({ a: 4, b: 13 });
  });

  it('fills only the missing side', () => {
    expect(resolvePair({ a: 8, b: null, scope: NATIONAL, regions })).toEqual({ a: 8, b: 4 });
    expect(resolvePair({ a: null, b: 4, scope: NATIONAL, regions })).toEqual({ a: 13, b: 4 });
    expect(resolvePair({ a: null, b: 8, scope: department(8), regions })).toEqual({ a: 4, b: 8 });
  });

  it('falls back to department order without comparison data', () => {
    expect(resolvePair({ a: null, b: null, scope: NATIONAL, regions: [] })).toEqual({ a: 1, b: 2 });
    expect(resolvePair({ a: null, b: null, scope: department(8), regions: [] })).toEqual({ a: 8, b: 1 });
  });

  it('ranks regions without data after those with data', () => {
    expect(resolvePair({ a: 4, b: null, scope: NATIONAL, regions: [regionRow(4, { totalCostIncrease: 5 })] })).toEqual({
      a: 4,
      b: 1,
    });
  });
});

describe('needsComparisonData', () => {
  it('only waits for the data when a side has to be chosen by default', () => {
    expect(needsComparisonData({ a: 4, b: 8 })).toBe(false);
    expect(needsComparisonData({ a: 4, b: null })).toBe(true);
    expect(needsComparisonData({ a: null, b: null })).toBe(true);
  });
});

describe('swapPair', () => {
  it('exchanges both sides', () => {
    expect(swapPair({ a: 4, b: 8 })).toEqual({ a: 8, b: 4 });
  });
});

describe('compareHref', () => {
  it('links to the comparison with the given regions only', () => {
    expect(compareHref()).toEqual({ pathname: '/compare', params: {} });
    expect(compareHref({ a: 4 })).toEqual({ pathname: '/compare', params: { a: '4' } });
    expect(compareHref({ a: 4, b: 8 })).toEqual({ pathname: '/compare', params: { a: '4', b: '8' } });
  });
});
