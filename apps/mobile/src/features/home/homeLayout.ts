import { breakpointFor, gutterFor, isWide, maxWidthFor, type Breakpoint } from '@/shared/layout/breakpoints';
import { space } from '@/shared/theme/tokens';

/**
 * Columns of the block grid under the hero (regions, paralyzed works, stalled, recent increases).
 * Four blocks on desktop go two by two instead of three and a lone one.
 */
export function homeGridColumns(breakpoint: Breakpoint, blockCount = 3): number {
  if (breakpoint === 'desktop') return blockCount === 4 ? 2 : 3;
  return breakpoint === 'tablet' ? 2 : 1;
}

/** Parts of the hero row (out of 12) taken by the hero; the ranking takes the rest. */
export const HERO_PARTS = 7;

/** Every home block pads its own content by this much; on wide screens it is part of the gutter. */
export const BLOCK_PADDING = space.lg;

/** The hero figure bleeds this much into the hero padding on each side. */
const FIGURE_BLEED = 8;

/** Side padding of the home column on wide screens: the gutter minus the blocks' own padding. */
export function homeColumnPadding(breakpoint: Breakpoint): number {
  return isWide(breakpoint) ? gutterFor(breakpoint) - BLOCK_PADDING : 0;
}

/** Width available to the hero figure before layout is measured, for a window width. */
export function heroFigureWidth(windowWidth: number): number {
  const breakpoint = breakpointFor(windowWidth);
  const column = Math.min(windowWidth, maxWidthFor(breakpoint)) - 2 * homeColumnPadding(breakpoint);
  const hero = isWide(breakpoint) ? column * (HERO_PARTS / 12) : column;
  return hero - 2 * BLOCK_PADDING + 2 * FIGURE_BLEED;
}
