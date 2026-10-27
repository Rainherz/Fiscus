import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScope } from '@/features/department/ScopeContext';
import { rankRegions, type RegionSort } from '@/features/investments/domain/regionComparison';
import { useRegionComparison } from '@/features/investments/hooks/queries';

import { pickRegion } from './pickRegion';
import { isRegionSort } from './regionPresentation';
import { RegionPickerView } from './RegionPickerView';

const DEFAULT_SORT: RegionSort = 'increase-amount';

/**
 * The region picker screen (`/region?sort=stalled`). It returns to the screen it was opened
 * from; opened directly from a link, there is nothing to go back to, so it opens Inicio.
 */
export function RegionPickerContainer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scope, setScope } = useScope();
  const params = useLocalSearchParams<{ sort?: string }>();
  const sort: RegionSort = isRegionSort(params.sort) ? params.sort : DEFAULT_SORT;
  const query = useRegionComparison();
  const regions = useMemo(() => rankRegions(query.data ?? [], sort), [query.data, sort]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <RegionPickerView
      sort={sort}
      regions={regions}
      status={query.status}
      current={scope}
      topInset={insets.top}
      bottomInset={insets.bottom}
      onSelectSort={(next) => router.setParams({ sort: next })}
      onRetry={() => query.refetch()}
      onPick={(next) => pickRegion(next, { setScope, close })}
      onClose={close}
    />
  );
}
