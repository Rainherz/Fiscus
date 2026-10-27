import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useDepartment } from '@/features/department/DepartmentContext';
import type { RankingKind } from '@/features/investments/domain/investment';
import { useRanking } from '@/features/investments/hooks/queries';

import { RankingsView } from './RankingsView';

export function RankingsContainer() {
  const router = useRouter();
  const { code } = useDepartment();
  const [kind, setKind] = useState<RankingKind>('increase-amount');
  const ranking = useRanking(kind, code);

  return (
    <RankingsView
      kind={kind}
      items={ranking.data?.pages.flat() ?? []}
      now={new Date()}
      status={ranking.status}
      isFetchingMore={ranking.isFetchingNextPage}
      onSelectKind={setKind}
      onEndReached={() => {
        if (ranking.hasNextPage && !ranking.isFetchingNextPage) ranking.fetchNextPage();
      }}
      onRetry={() => ranking.refetch()}
      onPressInvestment={(cui) => router.push({ pathname: '/investment/[cui]', params: { cui } })}
    />
  );
}
