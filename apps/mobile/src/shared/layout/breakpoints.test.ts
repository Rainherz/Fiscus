import {
  DESKTOP_MIN_WIDTH,
  LAYOUT_MAX_WIDTH,
  TABLET_MIN_WIDTH,
  breakpointFor,
  contentWidth,
  gutterFor,
  isWide,
  navPlacement,
} from './breakpoints';

describe('breakpointFor', () => {
  it('is phone below 768 px', () => {
    expect(breakpointFor(320)).toBe('phone');
    expect(breakpointFor(390)).toBe('phone');
    expect(breakpointFor(TABLET_MIN_WIDTH - 1)).toBe('phone');
  });

  it('is tablet from 768 to 1199 px', () => {
    expect(breakpointFor(TABLET_MIN_WIDTH)).toBe('tablet');
    expect(breakpointFor(1024)).toBe('tablet');
    expect(breakpointFor(DESKTOP_MIN_WIDTH - 1)).toBe('tablet');
  });

  it('is desktop from 1200 px', () => {
    expect(breakpointFor(DESKTOP_MIN_WIDTH)).toBe('desktop');
    expect(breakpointFor(1880)).toBe('desktop');
  });
});

describe('isWide', () => {
  it('is true for tablet and desktop only', () => {
    expect(isWide('phone')).toBe(false);
    expect(isWide('tablet')).toBe(true);
    expect(isWide('desktop')).toBe(true);
  });
});

describe('navPlacement', () => {
  it('keeps the bottom tab bar on phones and moves the tabs to the header on wider screens', () => {
    expect(navPlacement('phone')).toBe('bottom');
    expect(navPlacement('tablet')).toBe('header');
    expect(navPlacement('desktop')).toBe('header');
  });
});

describe('gutterFor', () => {
  it('widens the side gutter with the screen', () => {
    expect(gutterFor('phone')).toBe(20);
    expect(gutterFor('tablet')).toBe(32);
    expect(gutterFor('desktop')).toBe(40);
  });
});

describe('contentWidth', () => {
  it('is the window minus the gutters below the layout cap', () => {
    expect(contentWidth(1024)).toBe(1024 - 64);
  });

  it('is capped at the layout max width minus the gutters on large screens', () => {
    expect(contentWidth(1880)).toBe(LAYOUT_MAX_WIDTH - 80);
    expect(contentWidth(1440)).toBe(LAYOUT_MAX_WIDTH - 80);
  });

  it('is the window minus the phone gutters on phones', () => {
    expect(contentWidth(390)).toBe(390 - 40);
  });
});
