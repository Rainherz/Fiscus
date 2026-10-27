import { StyleSheet, View } from 'react-native';

import { colors, rule } from '@/shared/theme/tokens';

import { mirroredBarRatios } from './comparePresentation';

/** Fill of each side: the left region in ink, the right one in signal with an ink outline. */
export const SIDE_FILL = {
  a: { backgroundColor: colors.ink },
  b: { backgroundColor: colors.signal, borderWidth: rule, borderColor: colors.ink },
} as const;

const percent = (ratio: number) => `${Math.round(ratio * 1000) / 10}%` as const;

/**
 * Two horizontal bars from a center line: the left region grows left, the right one grows right,
 * both scaled to the larger value. Decorative: the values are printed next to it.
 */
export function MirroredBars({ a, b }: { a: number | null; b: number | null }) {
  const ratios = mirroredBarRatios(a, b);
  return (
    <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.half, styles.left]}>
        {ratios.a > 0 ? <View testID="bar-a" style={[styles.bar, SIDE_FILL.a, { width: percent(ratios.a) }]} /> : null}
      </View>
      <View style={styles.center} />
      <View style={styles.half}>
        {ratios.b > 0 ? <View testID="bar-b" style={[styles.bar, SIDE_FILL.b, { width: percent(ratios.b) }]} /> : null}
      </View>
    </View>
  );
}

const BAR_HEIGHT = 14;

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center', height: BAR_HEIGHT + 8 },
  half: { flex: 1, flexDirection: 'row' },
  // The left bar is anchored to the center line and grows towards the left edge.
  left: { justifyContent: 'flex-end' },
  bar: { height: BAR_HEIGHT, minWidth: 3 },
  center: { width: rule, alignSelf: 'stretch', backgroundColor: colors.ink, marginHorizontal: 2 },
});
