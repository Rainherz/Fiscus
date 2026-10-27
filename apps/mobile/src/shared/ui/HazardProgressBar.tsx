import { StyleSheet, View } from 'react-native';

import { colors, rule } from '../theme/tokens';

const STRIPE_WIDTH = 10;
const STRIPE_COUNT = 90; // covers ~1800px of fill; the fill clips the rest

interface Props {
  /** accrued / updated cost; may exceed 1 (clamped visually, reported as-is). */
  ratio: number | null;
  height?: number;
}

/** Ink track with a diagonal yellow/black hazard-striped fill. */
export function HazardProgressBar({ ratio, height = 22 }: Props) {
  const known = ratio !== null && Number.isFinite(ratio);
  const percent = known ? Math.round(ratio * 100) : 0;
  const fill = Math.min(Math.max(percent, 0), 100);
  const label = known
    ? `Avance de ejecución: ${percent} por ciento`
    : 'Avance de ejecución: sin dato';

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={known ? { min: 0, max: 100, now: percent } : undefined}
      style={[styles.track, { height }]}>
      <View testID="hazard-fill" style={[styles.fill, { width: `${fill}%` }]}>
        <View style={styles.stripes} pointerEvents="none">
          {Array.from({ length: STRIPE_COUNT }, (_, i) => (
            <View key={i} style={[styles.stripe, { left: i * STRIPE_WIDTH * 2 }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.ink,
    borderWidth: rule,
    borderColor: colors.ink,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  stripes: {
    ...StyleSheet.absoluteFill,
  },
  stripe: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: STRIPE_WIDTH,
    backgroundColor: colors.signal,
    transform: [{ skewX: '45deg' }],
  },
});
