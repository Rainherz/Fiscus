import { heroFigureWidth, homeGridColumns } from './homeLayout';

describe('homeGridColumns', () => {
  it('stacks the home blocks on phones, two per row on tablets and three on desktop', () => {
    expect(homeGridColumns('phone')).toBe(1);
    expect(homeGridColumns('tablet')).toBe(2);
    expect(homeGridColumns('desktop')).toBe(3);
  });

  it('lays four blocks out two by two on desktop, so no row holds a lone block', () => {
    expect(homeGridColumns('desktop', 4)).toBe(2);
    expect(homeGridColumns('desktop', 3)).toBe(3);
    expect(homeGridColumns('desktop', 2)).toBe(3);
    expect(homeGridColumns('tablet', 4)).toBe(2);
    expect(homeGridColumns('phone', 4)).toBe(1);
  });
});

describe('heroFigureWidth', () => {
  it('is the page column minus the hero padding on phones', () => {
    // 390 window, 20 px hero padding on each side, the figure bleeds 8 px into each.
    expect(heroFigureWidth(390)).toBe(390 - 40 + 16);
  });

  it('is the width of the hero column on desktop', () => {
    // 1280 column, 40 px gutters, 7 of 12 parts for the hero, 20 px hero padding on each side.
    expect(heroFigureWidth(1440)).toBeCloseTo((1280 - 40) * (7 / 12) - 40 + 16, 0);
  });

  it('is the width of the hero column on tablets', () => {
    expect(heroFigureWidth(1024)).toBeCloseTo((1024 - 24) * (7 / 12) - 40 + 16, 0);
  });
});
