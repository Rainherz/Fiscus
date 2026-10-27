import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouch, rule, space } from '../theme/tokens';
import { BodyText, MonoText } from './typography';

interface Props {
  name: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}

/** A list option without figures: a name, an optional detail line, and an "ACTUAL" tag when selected. */
export function OptionRow({ name, detail, selected, onPress }: Props) {
  const label = [name, detail?.toLowerCase(), selected ? 'actual' : undefined].filter(Boolean).join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected ? { selected: true } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && (selected ? styles.pressed : styles.optionPressed),
      ]}>
      <View style={styles.optionMain}>
        <BodyText weight={600} size={14} style={selected ? styles.selectedText : undefined}>
          {name}
        </BodyText>
        {detail ? (
          <MonoText size={11} muted style={selected ? styles.selectedDetail : undefined}>
            {detail}
          </MonoText>
        ) : null}
      </View>
      {selected ? (
        <MonoText bold size={11} style={styles.tag}>
          ACTUAL
        </MonoText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  option: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 9,
    borderTopWidth: rule,
    borderTopColor: colors.ink,
  },
  optionSelected: { backgroundColor: colors.ink, marginHorizontal: -space.sm, paddingHorizontal: space.sm },
  optionPressed: { backgroundColor: colors.concretePressed },
  optionMain: { flex: 1, gap: 2 },
  selectedText: { color: colors.signal },
  selectedDetail: { color: colors.concrete },
  tag: { color: colors.ink, backgroundColor: colors.signal, paddingHorizontal: space.xs },
});
