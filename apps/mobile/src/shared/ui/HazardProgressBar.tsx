import { StyleSheet, View } from 'react-native';

import { formatSolesCompact } from '../format';
import { colors, rule, space } from '../theme/tokens';
import { MonoText } from './typography';

const STRIPE_WIDTH = 10;
const STRIPE_COUNT = 90; // covers ~1800px of fill; the fill clips the rest

interface Props {
  /** Share of the updated cost already spent (accrued / updated cost); may exceed 1. */
  ratio: number | null;
  /** Soles spent beyond the updated cost, stated below the bar when the ratio exceeds 1. */
  overspend?: number | null;
  /** The source reports spending above 10 times the updated cost; stated below the bar. */
  anomaly?: boolean;
  height?: number;
}

/**
 * Ink track with a diagonal yellow/black hazard-striped fill. The fill is clamped to 100%;
 * the real percentage is reported to assistive technologies and overspend is stated in text.
 */
export const SPENT_ANOMALY_NOTICE =
  'Dato inusual en la fuente MEF: lo gastado supera 10 veces el costo actualizado.';

/** Sentence stated below the bar when spending exceeds the updated cost. */
export function overspendSentence(amount: number): string {
  return `Gastó ${formatSolesCompact(amount)} más que su costo actualizado`;
}

export function HazardProgressBar({ ratio, overspend = null, anomaly = false, height = 22 }: Props) {
  const known = ratio !== null && Number.isFinite(ratio);
  const percent = known ? Math.round(ratio * 100) : 0;
  const fill = Math.min(Math.max(percent, 0), 100);
  const label = known
    ? `Gastado: ${percent} por ciento del costo actualizado`
    : 'Gastado: sin dato';
  const overspent = known && ratio > 1 && overspend !== null && overspend > 0;

  return (
    <View style={styles.container}>
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
      {overspent ? (
        <MonoText bold size={12}>
          {overspendSentence(overspend)}
        </MonoText>
      ) : null}
      {anomaly ? (
        <MonoText size={11} muted>
          {SPENT_ANOMALY_NOTICE}
        </MonoText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
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
