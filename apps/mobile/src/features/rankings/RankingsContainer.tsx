import { useLocalSearchParams, useRouter } from 'expo-router';

import { departmentCodeOf } from '@/features/department/scope';
import { useScope } from '@/features/department/ScopeContext';
import type { RankingKind } from '@/features/investments/domain/investment';
import { useRanking, useStalledInvestments } from '@/features/investments/hooks/queries';

import { isRankingTab, type RankingList, type RankingTab } from './rankingPresentation';
import { RankingsView } from './RankingsView';

const DEFAULT_TAB: RankingKind = 'increase-amount';

/**
 * The selected tab lives in the route (`/rankings?tab=stalled`), so Home can link to any tab.
 * Unknown tabs, like the removed `regions`, open the default ranking.
 */
export function RankingsContainer() {
  const router = useRouter();
  const code = departmentCodeOf(useScope().scope);
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab: RankingTab = isRankingTab(params.tab) ? params.tab : DEFAULT_TAB;
  const rankingKind: RankingKind = tab === 'stalled' ? DEFAULT_TAB : tab;
  // Only the selected tab fetches.
  const ranking = useRanking(rankingKind, code, { enabled: tab !== 'stalled' });
  const stalled = useStalledInvestments(code, { enabled: tab === 'stalled' });
  const query = tab === 'stalled' ? stalled : ranking;

  const list: RankingList =
    tab === 'stalled'
      ? { kind: 'stalled', items: stalled.data?.pages.flat() ?? [] }
      : { kind: rankingKind, items: ranking.data?.pages.flat() ?? [] };

  return (
    <RankingsView
      list={list}
      now={new Date()}
      national={code === undefined}
      status={query.status}
      isFetchingMore={query.isFetchingNextPage}
      onSelectKind={(next) => router.setParams({ tab: next })}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
      }}
      onRetry={() => query.refetch()}
      onPressInvestment={(cui) => router.push({ pathname: '/investment/[cui]', params: { cui } })}
    />
  );
}
