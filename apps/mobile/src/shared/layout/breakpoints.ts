import { maxContentWidth } from '../theme/tokens';

/** Screen classes the layout adapts to. Phone layouts are the original single column. */
export type Breakpoint = 'phone' | 'tablet' | 'desktop';

export const TABLET_MIN_WIDTH = 768;
export const DESKTOP_MIN_WIDTH = 1200;
/** Content max width on tablet and desktop; the map stays full-bleed. */
export const LAYOUT_MAX_WIDTH = 1280;
/** Max width of single-column lists on tablet and desktop, where a full-width row would read poorly. */
export const COMPACT_MAX_WIDTH = 880;

export function breakpointFor(width: number): Breakpoint {
  if (width >= DESKTOP_MIN_WIDTH) return 'desktop';
  if (width >= TABLET_MIN_WIDTH) return 'tablet';
  return 'phone';
}

/** Tablet and desktop: multi-column layouts and the navigation in the header. */
export function isWide(breakpoint: Breakpoint): boolean {
  return breakpoint !== 'phone';
}

/** Where the four main tabs live: the bottom tab bar on phones, the header elsewhere. */
export function navPlacement(breakpoint: Breakpoint): 'bottom' | 'header' {
  return isWide(breakpoint) ? 'header' : 'bottom';
}

const GUTTER: Record<Breakpoint, number> = { phone: 20, tablet: 32, desktop: 40 };

/** Side padding of the content column. */
export function gutterFor(breakpoint: Breakpoint): number {
  return GUTTER[breakpoint];
}

/** Max width of the content column, gutters included. */
export function maxWidthFor(breakpoint: Breakpoint): number {
  return isWide(breakpoint) ? LAYOUT_MAX_WIDTH : maxContentWidth;
}

/** Width available to content inside the column for a window width, gutters excluded. */
export function contentWidth(windowWidth: number): number {
  const breakpoint = breakpointFor(windowWidth);
  return Math.min(windowWidth, maxWidthFor(breakpoint)) - 2 * gutterFor(breakpoint);
}
