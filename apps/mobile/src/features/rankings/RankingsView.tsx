import type { ReactNode } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import type { EntityComparison } from '@/features/investments/domain/entityComparison';
import { colors, maxContentWidth, space } from '@/shared/theme/tokens';
import type { Tag } from '@/shared/ui/LevelTag';
import { RankingRow } from '@/shared/ui/RankingRow';
import { SegmentedTabs } from '@/shared/ui/SegmentedTabs';
import { StateMessage } from '@/shared/ui/StateMessage';
import { MonoText } from '@/shared/ui/typography';

import { levelTag } from '../government-level/levelPresentation';
import { STALLED_EMPTY, stalledRowDetail } from '../stalled/stalledPresentation';
import {
  ENTITIES_EMPTY,
  ENTITY_SORT_OPTIONS,
  entityDetail,
  entityKey,
  entityNote,
  entitySummary,
  entityValue,
  type EntitySort,
} from './entityPresentation';
import {
  RANKINGS_SCREEN_OPTIONS,
  RANKING_OPTIONS,
  rankingDetail,
  rankingNote,
  rankingValue,
  type RankingList,
  type RankingTab,
} from './rankingPresentation';

interface Row {
  key: string;
  name: string | null;
  value?: string;
  detail: string | string[];
  summary?: string;
  tag?: Tag;
  onPress: () => void;
}

interface RowActions {
  onPressInvestment: (cui: string) => void;
  onPressEntity: (entity: EntityComparison) => void;
}

function toRows(list: RankingList, now: Date, national: boolean, sort: EntitySort, actions: RowActions): Row[] {
  switch (list.kind) {
    case 'entities':
      return list.items.map((item) => ({
        key: entityKey(item),
        name: item.entity,
        value: entityValue(sort, item),
        detail: entityDetail(sort, item, { national }),
        summary: entitySummary(sort, item),
        tag: levelTag(item.governmentLevel),
        onPress: () => actions.onPressEntity(item),
      }));
    case 'stalled':
      return list.items.map((item) => ({
        key: item.cui,
        name: item.name,
        detail: stalledRowDetail(item, { national }),
        tag: levelTag(item.governmentLevel),
        onPress: () => actions.onPressInvestment(item.cui),
      }));
    default: {
      const { kind } = list;
      return list.items.map((item) => ({
        key: item.cui,
        name: item.name,
        value: rankingValue(kind, item, now),
        detail: rankingDetail(kind, item, { national }),
        tag: levelTag(item.governmentLevel),
        onPress: () => actions.onPressInvestment(item.cui),
      }));
    }
  }
}

function emptyMessage(kind: RankingTab, national: boolean): string {
  if (kind === 'stalled') return STALLED_EMPTY;
  if (kind === 'entities') return ENTITIES_EMPTY;
  return `No hay proyectos para este ranking ${national ? 'en el país' : 'en esta región'}.`;
}

interface Props {
  list: RankingList;
  now: Date;
  /** Ranking all of Peru: rows show their region. */
  national?: boolean;
  status: 'pending' | 'error' | 'success';
  isFetchingMore: boolean;
  onSelectKind: (kind: RankingTab) => void;
  onEndReached: () => void;
  onRetry: () => void;
  onPressInvestment: (cui: string) => void;
  /** "screen": every tab of the Rankings screen; "projects": project rankings only (entity drill-down). */
  options?: 'screen' | 'projects';
  /** Sort of the "Entidades" tab. */
  entitySort?: EntitySort;
  onSelectEntitySort?: (sort: EntitySort) => void;
  onPressEntity?: (entity: EntityComparison) => void;
  /** Shown above the tabs (the entity drill-down names the entity). */
  header?: ReactNode;
}

export function RankingsView({
  list,
  now,
  national = false,
  status,
  isFetchingMore,
  onSelectKind,
  onEndReached,
  onRetry,
  onPressInvestment,
  options = 'screen',
  entitySort = 'increase-amount',
  onSelectEntitySort = () => {},
  onPressEntity = () => {},
  header,
}: Props) {
  const { kind } = list;
  const note = kind === 'entities' ? entityNote(entitySort, { national }) : rankingNote(kind);
  const rows = toRows(list, now, national, entitySort, { onPressInvestment, onPressEntity });
  const tabs: readonly { key: RankingTab; label: string }[] =
    options === 'screen' ? RANKINGS_SCREEN_OPTIONS : RANKING_OPTIONS;

  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
        {header ? <View style={styles.header}>{header}</View> : null}
        <SegmentedTabs options={tabs} selected={kind} onSelect={onSelectKind} />
        {kind === 'entities' ? (
          <SegmentedTabs
            options={ENTITY_SORT_OPTIONS}
            selected={entitySort}
            onSelect={onSelectEntitySort}
            accessibilityLabel="Ordenar entidades por"
          />
        ) : null}
        {note ? (
          <MonoText size={11} muted style={styles.note}>
            {note}
          </MonoText>
        ) : null}
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item: row, index }) => (
          <RankingRow
            rank={index + 1}
            name={row.name}
            value={row.value}
            detail={row.detail}
            summary={row.summary}
            tag={row.tag}
            onPress={row.onPress}
          />
        )}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          status === 'pending' ? (
            <StateMessage kind="loading" />
          ) : status === 'error' ? (
            <StateMessage kind="error" onRetry={onRetry} />
          ) : (
            <StateMessage kind="empty" message={emptyMessage(kind, national)} />
          )
        }
        ListFooterComponent={
          isFetchingMore ? <ActivityIndicator color={colors.ink} style={styles.more} /> : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  tabs: {
    paddingTop: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  header: { paddingHorizontal: space.lg, gap: space.xs },
  note: { paddingHorizontal: space.lg },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  more: { paddingVertical: space.lg },
});
