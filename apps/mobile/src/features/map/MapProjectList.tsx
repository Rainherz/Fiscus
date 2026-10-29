import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { projectTag } from '@/features/government-level/levelPresentation';
import type { MapListItem } from '@/features/investments/domain/mapPoints';
import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { RankingRow } from '@/shared/ui/RankingRow';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import { mapListCountText, mapListRow } from './mapPresentation';

/** The list of the view: the first page loading, failed, or the pages loaded so far. */
export type MapListState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; items: MapListItem[]; total: number; hasMore: boolean; loadingMore: boolean };

interface Props {
  list: MapListState;
  /** Some filter is on (changes the empty message). */
  filtered: boolean;
  selectedCui: string | null;
  /** False where the count is already shown (the bar of the phone sheet). */
  showCount?: boolean;
  onPressItem: (item: MapListItem) => void;
  onLoadMore: () => void;
  onRetry: () => void;
}

export const MAP_LIST_EMPTY = 'No hay proyectos con coordenadas en esta zona.';
export const MAP_LIST_EMPTY_FILTERED = 'No hay proyectos que cumplan los filtros en esta zona.';

/** The projects in view, largest cost increase first; refreshed when the map stops moving. */
export function MapProjectList({ list, filtered, selectedCui, showCount = true, onPressItem, onLoadMore, onRetry }: Props) {
  if (list.kind === 'loading') return <StateMessage kind="loading" />;
  if (list.kind === 'error') return <StateMessage kind="error" message="No se pudo cargar la lista." onRetry={onRetry} />;

  const footer = list.loadingMore ? (
    <View style={styles.more} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={colors.ink} />
      <MonoText size={12}>Cargando…</MonoText>
    </View>
  ) : list.hasMore ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cargar más"
      onPress={onLoadMore}
      style={({ pressed }) => [styles.moreButton, pressed && styles.moreButtonPressed]}>
      <DisplayText size={16}>Cargar más</DisplayText>
    </Pressable>
  ) : null;

  // A plain scroll view: pages are added on request ("Cargar más"), 30 rows at a time.
  return (
    <ScrollView>
      <View style={styles.head}>
        {showCount ? (
          <MonoText bold size={12}>
            {mapListCountText(list.total).toUpperCase()}
          </MonoText>
        ) : null}
        <MonoText size={11} muted>
          Ordenados por aumento de costo.
        </MonoText>
      </View>
      {list.items.length === 0 ? (
        <StateMessage kind="empty" message={filtered ? MAP_LIST_EMPTY_FILTERED : MAP_LIST_EMPTY} />
      ) : null}
      <View style={styles.rows}>
      {list.items.map((item, index) => {
        const row = mapListRow(item);
        return (
          <RankingRow
            key={item.cui}
            rank={index + 1}
            name={item.name}
            value={row.value}
            detail={row.detail}
            summary={row.summary}
            tag={projectTag(item)}
            selected={item.cui === selectedCui}
            selectedTag="EN EL MAPA"
            onPress={() => onPressItem(item)}
          />
        );
      })}
      </View>
      {footer}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    gap: 2,
  },
  rows: { paddingHorizontal: space.lg },
  more: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg },
  moreButton: {
    margin: space.lg,
    minHeight: minTouch,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: rule,
    borderColor: colors.ink,
  },
  moreButtonPressed: { backgroundColor: colors.concretePressed },
});
