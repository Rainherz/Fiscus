import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';

import { colors, minTouch, rule, space } from '../theme/tokens';
import { DisplayText } from './typography';

/** Window width from which the tabs wrap instead of scrolling. */
const WRAP_MIN_WIDTH = 768;

interface Option<K extends string> {
  key: K;
  label: string;
}

interface Props<K extends string> {
  options: readonly Option<K>[];
  selected: K;
  onSelect: (key: K) => void;
  /** Names the tab list for screen readers when a screen has more than one. */
  accessibilityLabel?: string;
}

/**
 * Segmented control: ink outline, selected segment in ink with signal text.
 * On phones it scrolls horizontally and scrolls the selected segment into view, so a tab opened
 * from a link is visible. On wide screens (tablet and desktop) the content column is capped, so a
 * scrolling row looks cut off at the column edge; there it wraps onto several lines instead.
 */
export function SegmentedTabs<K extends string>({ options, selected, onSelect, accessibilityLabel }: Props<K>) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [offsets, setOffsets] = useState<Partial<Record<K, number>>>({});
  const selectedOffset = offsets[selected];
  const wrap = useWindowDimensions().width >= WRAP_MIN_WIDTH;

  useEffect(() => {
    if (wrap || selectedOffset === undefined) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, selectedOffset - space.lg), animated: true });
  }, [wrap, selectedOffset]);

  const tabs = options.map((option) => {
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
  });

  if (wrap) {
    return (
      <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={[styles.list, styles.wrap]}>
        {tabs}
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.list}>
      {tabs}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
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
