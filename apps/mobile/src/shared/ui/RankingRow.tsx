import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouch, rule, space } from '../theme/tokens';
import { BodyText, MonoText } from './typography';

interface Props {
  rank: number;
  name: string | null;
  /** The ranked metric, right-aligned. Rows ranked by a sentence can leave it out. */
  value?: string;
  /** Secondary factual lines under the name. */
  detail?: string | string[];
  /** What screen readers announce after the name; defaults to the value or the detail lines. */
  summary?: string;
  onPress: () => void;
  /** Background the row sits on, to pick the pressed color. */
  tone?: 'concrete' | 'signal';
}

export function RankingRow({ rank, name, value, detail, summary, onPress, tone = 'concrete' }: Props) {
  const title = name ?? 'Sin nombre';
  const lines = detail === undefined ? [] : Array.isArray(detail) ? detail : [detail];
  const announced = summary ?? value ?? lines.join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${title}, ${announced}`}
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
        {lines.map((line) => (
          <MonoText key={line} size={11} muted>
            {line}
          </MonoText>
        ))}
      </View>
      {value !== undefined ? (
        <MonoText bold size={13} style={styles.value}>
          {value}
        </MonoText>
      ) : null}
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
