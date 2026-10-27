import { FlatList, StyleSheet, View } from 'react-native';

import { colors, maxContentWidth, space } from '@/shared/theme/tokens';
import { RankingRow } from '@/shared/ui/RankingRow';
import { SegmentedTabs } from '@/shared/ui/SegmentedTabs';
import { StateMessage } from '@/shared/ui/StateMessage';
import { MonoText } from '@/shared/ui/typography';

import type { RegionComparison, RegionSort } from '../investments/domain/regionComparison';
import { RANKING_OPTIONS, type RankingTab } from '../rankings/rankingPresentation';
import {
  REGIONS_EMPTY,
  REGIONS_HEADER_NOTE,
  REGION_SORT_OPTIONS,
  regionDetail,
  regionName,
  regionNote,
  regionSummary,
  regionValue,
} from './regionPresentation';

interface Props {
  sort: RegionSort;
  /** Already ranked by `sort`. */
  regions: RegionComparison[];
  status: 'pending' | 'error' | 'success';
  onSelectTab: (tab: RankingTab) => void;
  onSelectSort: (sort: RegionSort) => void;
  onRetry: () => void;
  onPressRegion: (departmentCode: number) => void;
}

/** "Regiones" tab of Rankings: the 25 departments compared by one figure. */
export function RegionsView({ sort, regions, status, onSelectTab, onSelectSort, onRetry, onPressRegion }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <SegmentedTabs
          options={RANKING_OPTIONS}
          selected="regions"
          onSelect={onSelectTab}
          accessibilityLabel="Rankings"
        />
        <MonoText size={11} muted style={styles.note}>
          {REGIONS_HEADER_NOTE}
        </MonoText>
        <MonoText bold size={11} style={styles.note}>
          ORDENAR POR
        </MonoText>
        <SegmentedTabs
          options={REGION_SORT_OPTIONS}
          selected={sort}
          onSelect={onSelectSort}
          accessibilityLabel="Ordenar regiones por"
        />
        <MonoText size={11} muted style={styles.note}>
          {regionNote(sort)}
        </MonoText>
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={regions}
        keyExtractor={(region) => String(region.departmentCode)}
        renderItem={({ item: region, index }) => (
          <RankingRow
            rank={index + 1}
            name={regionName(region)}
            value={regionValue(sort, region)}
            detail={regionDetail(sort, region)}
            summary={regionSummary(sort, region)}
            onPress={() => onPressRegion(region.departmentCode)}
          />
        )}
        ListEmptyComponent={
          status === 'pending' ? (
            <StateMessage kind="loading" />
          ) : status === 'error' ? (
            <StateMessage kind="error" onRetry={onRetry} />
          ) : (
            <StateMessage kind="empty" message={REGIONS_EMPTY} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  header: {
    paddingTop: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  note: { paddingHorizontal: space.lg },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
});
