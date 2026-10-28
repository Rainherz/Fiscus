import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouch, rule, space } from '../theme/tokens';
import { LevelTag, type Tag } from './LevelTag';
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
  /** The current choice: ink row with signal text, an "ACTUAL" tag, announced as selected. */
  selected?: boolean;
  /** Government level code shown before the first detail line, announced after the name. */
  tag?: Tag;
}

export function RankingRow({
  rank,
  name,
  value,
  detail,
  summary,
  onPress,
  tone = 'concrete',
  selected = false,
  tag,
}: Props) {
  const title = name ?? 'Sin nombre';
  const lines = detail === undefined ? [] : Array.isArray(detail) ? detail : [detail];
  const announced = summary ?? value ?? lines.join(', ');
  const text = selected ? styles.selectedText : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${title}, ${tag ? `${tag.label}, ` : ''}${announced}${selected ? ', actual' : ''}`}
      accessibilityState={selected ? { selected: true } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && styles.selected,
        pressed && !selected && { backgroundColor: tone === 'signal' ? colors.signalPressed : colors.concretePressed },
        pressed && selected && styles.pressedSelected,
      ]}>
      <MonoText bold size={12} style={[styles.rank, text]}>
        {rank}
      </MonoText>
      <View style={styles.main}>
        <BodyText weight={600} size={14} numberOfLines={2} style={text}>
          {title}
        </BodyText>
        {lines.length === 0 && tag ? <LevelTag tag={tag} inverted={selected} /> : null}
        {lines.map((line, index) => {
          const text = (
            <MonoText key={line} size={11} muted style={[styles.line, selected && styles.selectedDetail]}>
              {line}
            </MonoText>
          );
          return index === 0 && tag ? (
            <View key={line} style={styles.tagged}>
              <LevelTag tag={tag} inverted={selected} />
              {text}
            </View>
          ) : (
            text
          );
        })}
      </View>
      {selected ? (
        <View style={styles.end}>
          {value !== undefined ? (
            <MonoText bold size={13} style={[styles.value, text]}>
              {value}
            </MonoText>
          ) : null}
          <MonoText bold size={11} style={styles.tag}>
            ACTUAL
          </MonoText>
        </View>
      ) : value !== undefined ? (
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
  tagged: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs + 2 },
  line: { flexShrink: 1 },
  end: { alignItems: 'flex-end', gap: 2 },
  value: { textAlign: 'right' },
  /** The ink band bleeds into the list gutter so the text keeps its column. */
  selected: { backgroundColor: colors.ink, marginHorizontal: -space.sm, paddingHorizontal: space.sm },
  pressedSelected: { opacity: 0.85 },
  selectedText: { color: colors.signal },
  selectedDetail: { color: colors.concrete },
  tag: { color: colors.ink, backgroundColor: colors.signal, paddingHorizontal: space.xs },
});
