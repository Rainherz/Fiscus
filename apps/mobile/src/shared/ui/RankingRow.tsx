import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouch, rule, space } from '../theme/tokens';
import { BodyText, MonoText } from './typography';

interface Props {
  rank: number;
  name: string | null;
  value: string;
  detail?: string;
  onPress: () => void;
  /** Background the row sits on, to pick the pressed color. */
  tone?: 'concrete' | 'signal';
}

export function RankingRow({ rank, name, value, detail, onPress, tone = 'concrete' }: Props) {
  const title = name ?? 'Sin nombre';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${title}, ${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: tone === 'signal' ? colors.signalPressed : colors.concretePressed },
      ]}>
      <MonoText bold size={12} style={styles.rank}>
        {rank}
      </MonoText>
      <View style={styles.main}>
        <BodyText weight={600} size={14} numberOfLines={2}>
          {title}
        </BodyText>
        {detail ? (
          <MonoText size={11} muted>
            {detail}
          </MonoText>
        ) : null}
      </View>
      <MonoText bold size={13} style={styles.value}>
        {value}
      </MonoText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm + 2,
    paddingVertical: 9,
    borderTopWidth: rule,
    borderTopColor: colors.ink,
  },
  rank: { minWidth: 22 },
  main: { flex: 1, gap: 2 },
  value: { textAlign: 'right' },
});
