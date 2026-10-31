import type { ReactNode } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { FilteredEmptyState } from '@/features/department/FilteredEmptyState';
import type { EntityComparison } from '@/features/investments/domain/entityComparison';
import { gutterFor, isWide, LAYOUT_MAX_WIDTH } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
import { colors, maxContentWidth, space } from '@/shared/theme/tokens';
import { TermHint } from '@/features/glossary/TermHint';
import type { TermId } from '@/features/glossary/terms';
import { TableHeader, TableRow } from '@/shared/ui/DataTable';
import type { Tag } from '@/shared/ui/LevelTag';
import { RankingRow } from '@/shared/ui/RankingRow';
import { SegmentedTabs } from '@/shared/ui/SegmentedTabs';
import { StateMessage } from '@/shared/ui/StateMessage';
import { MonoText } from '@/shared/ui/typography';

import { levelTag, projectTag } from '../government-level/levelPresentation';
import { ACTIVE_ONLY_NOTE } from '../investment-status/statusPresentation';
import {
  CONTRACTORS_EMPTY,
  CONTRACTOR_SORT_OPTIONS,
  contractorRowDetail,
  contractorSortValue,
  contractorsNote,
} from '../infobras/infobrasPresentation';
import type { ContractorSort } from '../investments/domain/infobras';
import { PARALYZED_EMPTY, paralyzedRowDetail } from '../paralyzed/paralyzedPresentation';
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
import { rankingTable } from './rankingTable';

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
  onPressContractor: (ruc: string) => void;
}

function toRows(
  list: RankingList,
  now: Date,
  national: boolean,
  sorts: { entity: EntitySort; contractor: ContractorSort },
  actions: RowActions,
): Row[] {
  const sort = sorts.entity;
  switch (list.kind) {
    case 'contractors':
      return list.items.map((item) => {
        const value = contractorSortValue(sorts.contractor, item);
        const detail = contractorRowDetail(item);
        return {
          key: item.ruc,
          name: item.name ?? item.ruc,
          value,
          detail,
          summary: `${value}, ${detail}`,
          onPress: () => actions.onPressContractor(item.ruc),
        };
      });
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
        tag: projectTag(item),
        onPress: () => actions.onPressInvestment(item.cui),
      }));
    case 'paralyzed':
      return list.items.map((item) => ({
        key: item.cui,
        name: item.name,
        detail: paralyzedRowDetail(item, { national }),
        tag: projectTag(item),
        onPress: () => actions.onPressInvestment(item.cui),
      }));
    default: {
      const { kind } = list;
      return list.items.map((item) => ({
        key: item.cui,
        name: item.name,
        value: rankingValue(kind, item, now),
        detail: rankingDetail(kind, item, { national }),
        tag: projectTag(item),
        onPress: () => actions.onPressInvestment(item.cui),
      }));
    }
  }
}

/** What an empty tab lacks; FilteredEmptyState adds the filters that are on. */
function emptyWhat(kind: RankingTab): string {
  if (kind === 'stalled') return STALLED_EMPTY;
  if (kind === 'paralyzed') return PARALYZED_EMPTY;
  if (kind === 'contractors') return CONTRACTORS_EMPTY;
  if (kind === 'entities') return ENTITIES_EMPTY;
  return 'No hay proyectos para este ranking';
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
  /** Sort of the "Contratistas" tab. */
  contractorSort?: ContractorSort;
  onSelectContractorSort?: (sort: ContractorSort) => void;
  onPressContractor?: (ruc: string) => void;
  /** Shown above the tabs (the entity drill-down names the entity). */
  header?: ReactNode;
  /**
   * The selected tab only applies to active projects and only closed ones are shown
   * (isActiveOnlyTab): the list is replaced by a note.
   */
  activeOnlyHidden?: boolean;
  /** False where the list has its own level (an entity's projects): the empty state ignores the global one. */
  emptyFollowsLevel?: boolean;
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
  contractorSort = 'contract',
  onSelectContractorSort = () => {},
  onPressContractor = () => {},
  header,
  activeOnlyHidden = false,
  emptyFollowsLevel = true,
}: Props) {
  const { kind } = list;
  const note = activeOnlyHidden
    ? null
    : list.kind === 'entities'
      ? entityNote(entitySort, { national })
      : list.kind === 'contractors'
        ? contractorsNote(list.dataAsOf)
        : rankingNote(kind);
  const rows = toRows(
    list,
    now,
    national,
    { entity: entitySort, contractor: contractorSort },
    { onPressInvestment, onPressEntity, onPressContractor },
  );
  /** The second row of tabs: how entities or contractors are sorted. */
  const sortTabs = (gutterWidth?: number) =>
    kind === 'entities' ? (
      <SegmentedTabs
        options={ENTITY_SORT_OPTIONS}
        selected={entitySort}
        onSelect={onSelectEntitySort}
        accessibilityLabel="Ordenar entidades por"
        gutter={gutterWidth}
      />
    ) : kind === 'contractors' ? (
      <SegmentedTabs
        options={CONTRACTOR_SORT_OPTIONS}
        selected={contractorSort}
        onSelect={onSelectContractorSort}
        accessibilityLabel="Ordenar contratistas por"
        gutter={gutterWidth}
      />
    ) : null;
  const tabs: readonly { key: RankingTab; label: string }[] =
    options === 'screen' ? RANKINGS_SCREEN_OPTIONS : RANKING_OPTIONS;
  const breakpoint = useBreakpoint();
  const wide = isWide(breakpoint);
  const column = wide ? { maxWidth: LAYOUT_MAX_WIDTH } : null;
  const gutter = wide ? { paddingHorizontal: gutterFor(breakpoint) } : null;

  const empty = activeOnlyHidden ? (
    <FilteredEmptyState what={ACTIVE_ONLY_NOTE} describeFilters={false} followsLevel={emptyFollowsLevel} />
  ) : status === 'pending' ? (
      <StateMessage kind="loading" />
    ) : status === 'error' ? (
      <StateMessage kind="error" onRetry={onRetry} />
    ) : (
      <FilteredEmptyState
        what={emptyWhat(kind)}
        list={kind === 'paralyzed' ? 'paralyzed' : 'default'}
        followsLevel={emptyFollowsLevel}
      />
    );
  const more = isFetchingMore ? <ActivityIndicator color={colors.ink} style={styles.more} /> : undefined;

  const controls = (
    <View testID="rankings-controls" style={[styles.tabs, column]}>
      {header ? <View style={[styles.header, gutter]}>{header}</View> : null}
      <SegmentedTabs options={tabs} selected={kind} onSelect={onSelectKind} gutter={wide ? gutterFor(breakpoint) : undefined} />
      {sortTabs(wide ? gutterFor(breakpoint) : undefined)}
      {note ? (
        <MonoText size={11} muted style={[styles.note, gutter]}>
          {note}
        </MonoText>
      ) : null}
    </View>
  );

  if (wide) {
    const spread = breakpoint === 'desktop';
    const table = rankingTable(list, now, { national, compact: !spread, entitySort, contractorSort });
    // Contractors have no level or region.
    const contractors = list.kind === 'contractors';
    const layout = { columns: table.columns, spread, national: national && !contractors, levelColumn: !contractors };
    return (
      <View style={styles.screen}>
        {controls}
        <FlatList
          style={styles.list}
          contentContainerStyle={[styles.listContent, column, gutter]}
          data={table.rows}
          keyExtractor={(row) => row.key}
          stickyHeaderIndices={table.rows.length > 0 ? [0] : undefined}
          ListHeaderComponent={
            table.rows.length > 0 ? (
              <TableHeader
                {...layout}
                renderHint={spread ? (term, onInk) => <TermHint term={term as TermId} onInk={onInk} /> : undefined}
              />
            ) : undefined
          }
          renderItem={({ item: row, index }) => (
            <TableRow
              {...layout}
              rank={index + 1}
              row={row}
              onPress={() => {
                const { target } = row;
                if (target.kind === 'investment') onPressInvestment(target.cui);
                else if (target.kind === 'contractor') onPressContractor(target.ruc);
                else if (list.kind === 'entities') onPressEntity(list.items[target.index]);
              }}
            />
          )}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={empty}
          ListFooterComponent={more}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
        {header ? <View style={styles.header}>{header}</View> : null}
        <SegmentedTabs options={tabs} selected={kind} onSelect={onSelectKind} />
        {sortTabs()}
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
        ListEmptyComponent={empty}
        ListFooterComponent={more}
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
