import { FIT_LETTER_SPACING_EM, fitFontSize, textWidthEm } from './fitFontSize';

/** Rendered width in px of `text` at `size`, using the face's advances and the tracking. */
const renderedWidth = (text: string, size: number) =>
  size * textWidthEm(text, FIT_LETTER_SPACING_EM);

describe('textWidthEm', () => {
  it('sums the advances of Big Shoulders Display Black for figures', () => {
    // + 0.536, 2 0.49, 8 0.5, 5 0.515, % 0.682
    expect(textWidthEm('+285%')).toBeCloseTo(2.723, 3);
  });

  it('subtracts the letter spacing for every glyph', () => {
    expect(textWidthEm('+285%', -0.025)).toBeCloseTo(2.723 - 0.125, 3);
  });

  it('falls back to a conservative advance for unknown glyphs', () => {
    expect(textWidthEm('W')).toBeGreaterThanOrEqual(0.7);
  });
});

describe('fitFontSize', () => {
  it('caps at the maximum size when there is room', () => {
    expect(fitFontSize({ text: '+285%', width: 1000, max: 136 })).toBe(136);
  });

  it.each([296, 321, 336, 366])('fits +285%% on one line within %ipx', (width) => {
    const size = fitFontSize({ text: '+285%', width, max: 136 });
    expect(renderedWidth('+285%', size)).toBeLessThanOrEqual(width);
  });

  it('shrinks long figures so they fit on one line', () => {
    const size = fitFontSize({ text: '+12,346%', width: 350, max: 136 });
    expect(size).toBeLessThan(136);
    expect(renderedWidth('+12,346%', size)).toBeLessThanOrEqual(350);
  });

  it('never goes below the minimum', () => {
    expect(fitFontSize({ text: '+1,000,000,000%', width: 100, max: 136, min: 32 })).toBe(32);
  });

  it('uses the maximum when the width is unknown', () => {
    expect(fitFontSize({ text: '+285%', width: 0, max: 136 })).toBe(136);
  });
});
