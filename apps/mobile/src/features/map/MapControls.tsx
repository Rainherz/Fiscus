import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { LEVEL_OPTIONS } from '@/features/government-level/levelPresentation';
import type { LevelFilter } from '@/features/investments/domain/governmentLevel';
import type { MapFilter } from '@/features/investments/domain/mapPoints';
import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { SegmentedTabs } from '@/shared/ui/SegmentedTabs';
import { MonoText } from '@/shared/ui/typography';

import { MAP_FILTER_OPTIONS } from './mapFilters';

/** Window width from which the map shows its list beside it (tablet, desktop). */
export const MAP_WIDE_MIN_WIDTH = 768;

interface Props {
  /** "Todo el Perú" or the department. */
  scopeLabel: string;
  level: LevelFilter;
  filters: readonly MapFilter[];
  /** Chips left out ("Sin gasto reciente" while only closed projects are shown). */
  hiddenFilters?: readonly MapFilter[];
  onPressScope: () => void;
  onSelectLevel: (level: LevelFilter) => void;
  onToggleFilter: (filter: MapFilter) => void;
}

/**
 * Above the map: the scope (opens the region picker), the level of government (the app's level,
 * the same state as the picker) and the filter chips (several at once, combined with AND).
 */
export function MapControls({
  scopeLabel,
  level,
  filters,
  hiddenFilters = [],
  onPressScope,
  onSelectLevel,
  onToggleFilter,
}: Props) {
  const wide = useWindowDimensions().width >= MAP_WIDE_MIN_WIDTH;
  const chips = MAP_FILTER_OPTIONS.filter((option) => !hiddenFilters.includes(option.key)).map((option) => {
    const checked = filters.includes(option.key);
    return (
      <Pressable
        key={option.key}
        accessibilityRole="checkbox"
        accessibilityLabel={option.label}
        accessibilityState={{ checked }}
        onPress={() => onToggleFilter(option.key)}
        style={({ pressed }) => [styles.chip, checked && styles.chipOn, pressed && !checked && styles.chipPressed]}>
        <MonoText bold size={12} style={checked ? styles.chipOnText : undefined}>
          {checked ? `✓ ${option.label}` : option.label}
        </MonoText>
      </Pressable>
    );
  });

  return (
    <View style={styles.box}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Región: ${scopeLabel}. Cambiar región`}
        onPress={onPressScope}
        style={({ pressed }) => [styles.scope, pressed && styles.scopePressed]}>
        <MonoText bold size={12}>
          {scopeLabel.toUpperCase()}
        </MonoText>
        <MonoText bold size={11} muted>
          CAMBIAR →
        </MonoText>
      </Pressable>
      {wide ? (
        // One row on wide screens: the level, a rule, then the filters.
        <View style={styles.wideRow}>
          <SegmentedTabs options={LEVEL_OPTIONS} selected={level} onSelect={onSelectLevel} accessibilityLabel="Nivel de gobierno" />
          <View style={[styles.chips, styles.chipsWrap, styles.wideChips]}>{chips}</View>
        </View>
      ) : (
        <>
          <SegmentedTabs options={LEVEL_OPTIONS} selected={level} onSelect={onSelectLevel} accessibilityLabel="Nivel de gobierno" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chips}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: rule,
    borderBottomColor: colors.ink,
  },
  scope: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    minHeight: 36,
    paddingHorizontal: space.lg,
  },
  scopePressed: { opacity: 0.6 },
  chips: { paddingHorizontal: space.lg, gap: space.sm },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  wideRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: space.sm },
  wideChips: { borderLeftWidth: rule, borderLeftColor: colors.ink },
  chip: {
    minHeight: minTouch,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderWidth: rule,
    borderColor: colors.ink,
    backgroundColor: colors.concrete,
  },
  chipOn: { backgroundColor: colors.signal },
  chipOnText: { color: colors.ink },
  chipPressed: { backgroundColor: colors.concretePressed },
});
