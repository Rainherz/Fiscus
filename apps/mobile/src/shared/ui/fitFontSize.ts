/**
 * Font size that keeps `text` on one line within `width`. `emPerChar` is the average glyph
 * advance of Big Shoulders Display Black for figures (condensed face, ~0.5em) plus margin.
 * Needed on web, where react-native-web ignores adjustsFontSizeToFit.
 */
export function fitFontSize(params: {
  text: string;
  width: number;
  max: number;
  min?: number;
  emPerChar?: number;
}): number {
  const { text, width, max, min = 24, emPerChar = 0.56 } = params;
  if (width <= 0 || text.length === 0) return max;
  const fitted = Math.floor(width / (text.length * emPerChar));
  return Math.max(min, Math.min(max, fitted));
}
