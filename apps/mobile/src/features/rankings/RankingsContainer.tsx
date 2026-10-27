import { useLocalSearchParams, useRouter } from 'expo-router';

import { useReadScope } from '@/features/department/ScopeContext';
import type { RankingKind } from '@/features/investments/domain/investment';
import {
  useEntityComparison,
  useRanking,
  useStalledInvestments,
  type ReadScope,
} from '@/features/investments/hooks/queries';
import { blurActiveElement } from '@/shared/navigation/blurActiveElement';

import { entityHref } from './entityRoute';
import { isEntitySort, type EntitySort } from './entityPresentation';
import { isRankingTab, type RankingList, type RankingTab } from './rankingPresentation';
import { RankingsView } from './RankingsView';

const DEFAULT_TAB: RankingKind = 'increase-amount';
const DEFAULT_ENTITY_SORT: EntitySort = 'increase-amount';

/** The rows and paging state of one ranking tab in a read scope; only the selected tab fetches. */
export function useRankingList(tab: RankingTab, read: ReadScope, entitySort: EntitySort = DEFAULT_ENTITY_SORT) {
  const rankingKind: RankingKind = tab === 'stalled' || tab === 'entities' ? DEFAULT_TAB : tab;
  const ranking = useRanking(rankingKind, read, { enabled: tab !== 'stalled' && tab !== 'entities' });
  const stalled = useStalledInvestments(read, { enabled: tab === 'stalled' });
  const entities = useEntityComparison(entitySort, read, { enabled: tab === 'entities' });

  const list: RankingList =
    tab === 'stalled'
      ? { kind: 'stalled', items: stalled.data?.pages.flat() ?? [] }
      : tab === 'entities'
        ? { kind: 'entities', items: entities.data?.pages.flat() ?? [] }
        : { kind: rankingKind, items: ranking.data?.pages.flat() ?? [] };
  const query = tab === 'stalled' ? stalled : tab === 'entities' ? entities : ranking;
  return {
    list,
    status: query.status,
    isFetchingMore: query.isFetchingNextPage,
    onEndReached: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
    onRetry: () => query.refetch(),
  };
}

/**
 * The selected tab lives in the route (`/rankings?tab=stalled`, `/rankings?tab=entities&sort=stalled`),
 * so Home can link to any tab. Unknown tabs, like the removed `regions`, open the default ranking.
 */
export function RankingsContainer() {
  const router = useRouter();
  const read = useReadScope();
  const params = useLocalSearchParams<{ tab?: string; sort?: string }>();
  const tab: RankingTab = isRankingTab(params.tab) ? params.tab : DEFAULT_TAB;
  const entitySort: EntitySort = isEntitySort(params.sort) ? params.sort : DEFAULT_ENTITY_SORT;
  const ranking = useRankingList(tab, read, entitySort);

  return (
    <RankingsView
      {...ranking}
      now={new Date()}
      national={read.departmentCode === undefined}
      entitySort={entitySort}
      onSelectKind={(next) => router.setParams({ tab: next })}
      onSelectEntitySort={(next) => router.setParams({ sort: next })}
      onPressInvestment={(cui) => router.push({ pathname: '/investment/[cui]', params: { cui } })}
      onPressEntity={(entity) => {
        blurActiveElement();
        router.push(entityHref(entity));
      }}
    />
  );
}
