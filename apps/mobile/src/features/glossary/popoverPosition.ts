/** Width of the definition popover (tablet and desktop). */
export const POPOVER_WIDTH = 320;
const MARGIN = 16;
const GAP = 8;

export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PopoverPosition = { left: number; top: number } | { left: number; bottom: number };

/**
 * Where the popover goes, in window coordinates: centered on the button and kept inside the
 * window; below the button in the upper half of the window, above it in the lower half (with
 * `bottom`, so its height need not be known). Without an anchor: centered, a third down.
 */
export function popoverPosition(anchor: Anchor | null, window: { width: number; height: number }): PopoverPosition {
  const maxLeft = window.width - POPOVER_WIDTH - MARGIN;
  if (!anchor) return { left: Math.max(MARGIN, (window.width - POPOVER_WIDTH) / 2), top: window.height / 3 };
  const centered = anchor.x + anchor.width / 2 - POPOVER_WIDTH / 2;
  const left = Math.round(Math.min(Math.max(centered, MARGIN), Math.max(MARGIN, maxLeft)));
  if (anchor.y + anchor.height / 2 > window.height / 2) {
    return { left, bottom: window.height - anchor.y + GAP };
  }
  return { left, top: anchor.y + anchor.height + GAP };
}
