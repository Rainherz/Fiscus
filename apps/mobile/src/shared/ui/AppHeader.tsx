import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouch, space } from '../theme/tokens';
import { DisplayText, MonoText } from './typography';

interface Props {
  /** "Todo el Perú" or a department name; null while the last choice is being read. */
  scopeLabel: string | null;
  onPressScope: () => void;
  /** Safe-area top inset, supplied by the container. */
  topInset?: number;
}

/** Black bar: brand in signal yellow and the scope (region) selector trigger. */
export function AppHeader({ scopeLabel, onPressScope, topInset = 0 }: Props) {
  return (
    <View style={[styles.bar, { paddingTop: topInset + 12 }]}>
      <DisplayText weight={900} size={30} style={styles.brand} accessibilityRole="header">
        FISCUS
      </DisplayText>
      {scopeLabel === null ? (
        <View style={styles.selector} accessible accessibilityLabel="Cargando región">
          <View style={styles.placeholder} />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cambiar región. Región actual: ${scopeLabel}`}
          hitSlop={8}
          onPress={onPressScope}
          style={({ pressed }) => [styles.selector, pressed && styles.pressed]}>
          <MonoText size={12} style={styles.selectorText}>
            {`${scopeLabel.toUpperCase()} ▾`}
          </MonoText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.ink,
    paddingHorizontal: space.lg,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { color: colors.signal, letterSpacing: 1 },
  selector: {
    minHeight: minTouch,
    paddingHorizontal: space.xs,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  selectorText: { color: colors.concrete },
  /** Bar the size of a short label, in a muted tone of the selector text. */
  placeholder: { width: 96, height: 12, backgroundColor: colors.muted },
});
