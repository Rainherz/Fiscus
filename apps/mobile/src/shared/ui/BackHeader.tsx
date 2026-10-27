import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouch, space } from '../theme/tokens';
import { DisplayText, MonoText } from './typography';

interface Props {
  onBack: () => void;
  title?: string;
  topInset?: number;
}

/** Black bar for pushed screens: back action and an optional title. */
export function BackHeader({ onBack, title, topInset = 0 }: Props) {
  return (
    <View style={[styles.bar, { paddingTop: topInset + 8 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver"
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <MonoText bold size={13} style={styles.backText}>
          ← VOLVER
        </MonoText>
      </Pressable>
      {title ? (
        <DisplayText size={18} numberOfLines={1} style={styles.title}>
          {title}
        </DisplayText>
      ) : (
        <DisplayText weight={900} size={22} style={styles.title}>
          FISCUS
        </DisplayText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.ink,
    paddingHorizontal: space.lg,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  back: { minHeight: minTouch, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  backText: { color: colors.concrete },
  title: { color: colors.signal, flexShrink: 1, textAlign: 'right' },
});
