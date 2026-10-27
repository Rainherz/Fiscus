import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, type ScrollViewInstance } from 'react-native';

import { colors, minTouch, rule, space } from '../theme/tokens';
import { DisplayText } from './typography';

interface Option<K extends string> {
  key: K;
  label: string;
}

interface Props<K extends string> {
  options: readonly Option<K>[];
  selected: K;
  onSelect: (key: K) => void;
}

/**
 * Horizontally scrollable segmented control: ink outline, selected segment in ink with signal text.
 * The selected segment is scrolled into view, so a tab opened from a link is visible.
 */
export function SegmentedTabs<K extends string>({ options, selected, onSelect }: Props<K>) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [offsets, setOffsets] = useState<Partial<Record<K, number>>>({});
  const selectedOffset = offsets[selected];

  useEffect(() => {
    if (selectedOffset === undefined) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, selectedOffset - space.lg), animated: true });
  }, [selectedOffset]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      contentContainerStyle={styles.list}>
      {options.map((option) => {
        const isSelected = option.key === selected;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(option.key)}
            onLayout={(event) => {
              const { x } = event.nativeEvent.layout;
              setOffsets((current) => (current[option.key] === x ? current : { ...current, [option.key]: x }));
            }}
            style={({ pressed }) => [
              styles.tab,
              isSelected && styles.selected,
              pressed && !isSelected && styles.pressed,
            ]}>
            <DisplayText size={16} style={{ color: isSelected ? colors.signal : colors.ink }}>
              {option.label}
            </DisplayText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  tab: {
    minHeight: minTouch,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderWidth: rule,
    borderColor: colors.ink,
  },
  selected: { backgroundColor: colors.ink },
  pressed: { backgroundColor: colors.concretePressed },
});
