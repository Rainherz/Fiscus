import { useLocalSearchParams, useRouter } from 'expo-router';

import { useDepartment } from '@/features/department/DepartmentContext';
import type { RankingKind } from '@/features/investments/domain/investment';
import { useRanking, useStalledInvestments } from '@/features/investments/hooks/queries';

import { RegionsContainer } from '../regions/RegionsContainer';
import { isRankingTab, type RankingList, type RankingTab } from './rankingPresentation';
import { RankingsView } from './RankingsView';

const DEFAULT_TAB: RankingKind = 'increase-amount';

/** The selected tab lives in the route (`/rankings?tab=stalled`), so Home can link to any tab. */
export function RankingsContainer() {
  const router = useRouter();
  const { code } = useDepartment();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab: RankingTab = isRankingTab(params.tab) ? params.tab : DEFAULT_TAB;
  const rankingKind: RankingKind = tab === 'stalled' || tab === 'regions' ? DEFAULT_TAB : tab;
  // Only the selected tab fetches.
  const ranking = useRanking(rankingKind, code, { enabled: tab !== 'stalled' && tab !== 'regions' });
  const stalled = useStalledInvestments(code, { enabled: tab === 'stalled' });
  const query = tab === 'stalled' ? stalled : ranking;

  // "Regiones" compares departments, so it does not depend on the selected region.
  if (tab === 'regions') return <RegionsContainer />;

  const list: RankingList =
    tab === 'stalled'
      ? { kind: 'stalled', items: stalled.data?.pages.flat() ?? [] }
      : { kind: rankingKind, items: ranking.data?.pages.flat() ?? [] };

  return (
    <RankingsView
      list={list}
      now={new Date()}
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
