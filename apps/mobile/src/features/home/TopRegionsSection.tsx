import { Pressable, StyleSheet, View } from 'react-native';

import { rankRegions, type RegionComparison } from '@/features/investments/domain/regionComparison';
import { REGIONS_EMPTY, regionDetail, regionName, regionNote, regionValue } from '@/features/regions/regionPresentation';
import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { RankingRow } from '@/shared/ui/RankingRow';
import { FilteredEmptyState } from '@/features/department/FilteredEmptyState';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

export const TOP_REGIONS_COUNT = 5;

/** The regions with the largest sum of cost increases, largest first; regions without any are left out. */
export function topRegionsByIncrease(regions: readonly RegionComparison[]): RegionComparison[] {
  return rankRegions(
    regions.filter((region) => region.totalCostIncrease > 0),
    'increase-amount',
  ).slice(0, TOP_REGIONS_COUNT);
}

export type TopRegionsState =
  | { status: 'pending' }
  | { status: 'error'; onRetry: () => void }
  | { status: 'success'; regions: RegionComparison[] };

interface Props {
  /** Already ranked and cut (see topRegionsByIncrease). */
  state: TopRegionsState;
  /** Which government levels the figures cover (see regionsNote). */
  note?: string;
  onPressRegion: (departmentCode: number) => void;
  /** Opens the region picker with the 25 regions. */
  onPressSeeAll: () => void;
  /** Opens the side-by-side comparison of two regions. */
  onPressCompare?: () => void;
}

/** "Regiones con más aumentos" on the national home screen. Tapping a region selects it. */
export function TopRegionsSection({ state, note, onPressRegion, onPressSeeAll, onPressCompare }: Props) {
  return (
    <View style={styles.section}>
      <DisplayText weight={900} size={22} accessibilityRole="header" style={styles.title}>
        REGIONES CON MÁS AUMENTOS
      </DisplayText>
      {note ? (
        <MonoText size={11} muted style={styles.note}>
          {note}
        </MonoText>
      ) : null}
      {state.status === 'pending' ? (
        <StateMessage kind="loading" />
      ) : state.status === 'error' ? (
        <StateMessage kind="error" message="No se pudieron cargar las regiones." onRetry={state.onRetry} />
      ) : state.regions.length === 0 ? (
        <FilteredEmptyState what={REGIONS_EMPTY} followsScope={false} />
      ) : (
        <>
          <MonoText size={11} muted style={styles.note}>
            {regionNote('increase-amount')}
          </MonoText>
          {state.regions.map((region, index) => (
            <RankingRow
              key={region.departmentCode}
              rank={index + 1}
              name={regionName(region)}
              value={regionValue('increase-amount', region)}
              detail={regionDetail('increase-amount', region)}
              onPress={() => onPressRegion(region.departmentCode)}
            />
          ))}
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver las 25 regiones"
        onPress={onPressSeeAll}
        style={({ pressed }) => [styles.seeAll, pressed && styles.seeAllPressed]}>
        <DisplayText size={18}>Ver las 25 →</DisplayText>
      </Pressable>
      {onPressCompare ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comparar dos regiones"
          onPress={onPressCompare}
          style={({ pressed }) => [styles.compare, pressed && styles.comparePressed]}>
          <DisplayText weight={900} size={20}>
            Comparar dos regiones →
          </DisplayText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl, paddingHorizontal: space.lg },
  title: { marginBottom: 2 },
  note: { marginBottom: 6 },
  seeAll: {
    minHeight: minTouch,
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: colors.ink,
  },
  seeAllPressed: { backgroundColor: colors.concretePressed },
  compare: {
    minHeight: minTouch + 8,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderWidth: rule,
    borderColor: colors.ink,
    backgroundColor: colors.signal,
  },
  comparePressed: { backgroundColor: colors.signalPressed },
});
