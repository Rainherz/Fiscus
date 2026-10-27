/** Visual direction B · "Obra": concrete ground, ink, signal yellow, hard edges. */
export const colors = {
  concrete: '#D4D0C8',
  ink: '#111111',
  signal: '#FFC20E',
  /** Secondary text on concrete (contrast ~6:1). */
  muted: '#4A463F',
  /** Pressed state on concrete. */
  concretePressed: '#C4BFB5',
  /** Pressed state on signal. */
  signalPressed: '#E8AF00',
} as const;

/** Font family keys registered with expo-font (see app/_layout.tsx). Never combine with fontWeight. */
export const fonts = {
  display800: 'BigShouldersDisplay_800ExtraBold',
  display900: 'BigShouldersDisplay_900Black',
  body400: 'InterTight_400Regular',
  body600: 'InterTight_600SemiBold',
  body700: 'InterTight_700Bold',
  mono400: 'JetBrainsMono_400Regular',
  mono700: 'JetBrainsMono_700Bold',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 24,
} as const;

/** All rules and borders are 2px solid ink. */
export const rule = 2;
export const minTouch = 44;
/** Content max width on large screens (web). */
export const maxContentWidth = 640;
