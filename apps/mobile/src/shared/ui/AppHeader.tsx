import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouch, space } from '../theme/tokens';
import { DisplayText, MonoText } from './typography';

interface Props {
  departmentName: string;
  onPressDepartment: () => void;
  /** Safe-area top inset, supplied by the container. */
  topInset?: number;
}

/** Black bar: brand in signal yellow and the department selector trigger. */
export function AppHeader({ departmentName, onPressDepartment, topInset = 0 }: Props) {
  return (
    <View style={[styles.bar, { paddingTop: topInset + 12 }]}>
      <DisplayText weight={900} size={30} style={styles.brand} accessibilityRole="header">
        FISCUS
      </DisplayText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Cambiar región. Región actual: ${departmentName}`}
        hitSlop={8}
        onPress={onPressDepartment}
        style={({ pressed }) => [styles.selector, pressed && styles.pressed]}>
        <MonoText size={12} style={styles.selectorText}>
          {`${departmentName.toUpperCase()} ▾`}
        </MonoText>
      </Pressable>
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
});
