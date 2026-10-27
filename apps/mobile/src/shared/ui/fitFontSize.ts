/**
 * Advance widths (em) of Big Shoulders Display Black for the glyphs used in figures, read from
 * BigShouldersDisplay_900Black.ttf. Needed on web, where react-native-web ignores
 * adjustsFontSizeToFit, so the size is computed from the text and the available width.
 */
const ADVANCE_EM: Record<string, number> = {
  '+': 0.536,
  '-': 0.446,
  '−': 0.536,
  '0': 0.507,
  '1': 0.274,
  '2': 0.49,
  '3': 0.504,
  '4': 0.511,
  '5': 0.515,
  '6': 0.498,
  '7': 0.485,
  '8': 0.5,
  '9': 0.499,
  '%': 0.682,
  ',': 0.251,
  '.': 0.25,
  ' ': 0.2,
};

/** Conservative advance for glyphs outside the table (wider than any uppercase letter average). */
const FALLBACK_ADVANCE_EM = 0.7;

/** Tracking applied by FitDisplayText, in em (negative tightens). */
export const FIT_LETTER_SPACING_EM = -0.025;

/** Share of the width the text may use; absorbs rounding and font hinting differences. */
const SAFETY = 0.95;

/** Width of `text` in em, including `letterSpacingEm` after every glyph. */
export function textWidthEm(text: string, letterSpacingEm = 0): number {
  let width = 0;
  for (const char of text) width += (ADVANCE_EM[char] ?? FALLBACK_ADVANCE_EM) + letterSpacingEm;
  return width;
}

/** Largest font size (within min..max) that keeps `text` on one line within `width`. */
export function fitFontSize(params: {
  text: string;
  width: number;
  max: number;
  min?: number;
  letterSpacingEm?: number;
}): number {
  const { text, width, max, min = 24, letterSpacingEm = FIT_LETTER_SPACING_EM } = params;
  const em = textWidthEm(text, letterSpacingEm);
  if (width <= 0 || em <= 0) return max;
  const fitted = Math.floor((width * SAFETY) / em);
  return Math.max(min, Math.min(max, fitted));
}
