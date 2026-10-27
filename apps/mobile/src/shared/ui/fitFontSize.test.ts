import { fitFontSize } from './fitFontSize';

describe('fitFontSize', () => {
  it('caps at the maximum size when there is room', () => {
    expect(fitFontSize({ text: '+285%', width: 1000, max: 136 })).toBe(136);
  });

  it('shrinks long figures so they fit on one line', () => {
    const size = fitFontSize({ text: '+12,346%', width: 350, max: 136 });
    expect(size).toBeLessThan(136);
    expect(size * 8 * 0.56).toBeLessThanOrEqual(350);
  });

  it('never goes below the minimum', () => {
    expect(fitFontSize({ text: '+1,000,000,000%', width: 100, max: 136, min: 32 })).toBe(32);
  });

  it('uses the maximum before layout is known', () => {
    expect(fitFontSize({ text: '+285%', width: 0, max: 136 })).toBe(136);
  });
});
