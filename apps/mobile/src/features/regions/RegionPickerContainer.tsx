import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { compareHref } from '@/features/compare/compareSelection';
import { useScope } from '@/features/department/ScopeContext';
import { rankRegions, type RegionSort } from '@/features/investments/domain/regionComparison';
import { useRegionComparison } from '@/features/investments/hooks/queries';
import { blurActiveElement } from '@/shared/navigation/blurActiveElement';

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
  const { scope, setScope, level, setLevel, status, setStatus } = useScope();
  const params = useLocalSearchParams<{ sort?: string }>();
  const sort: RegionSort = isRegionSort(params.sort) ? params.sort : DEFAULT_SORT;
  const query = useRegionComparison(level, status);
  const regions = useMemo(() => rankRegions(query.data ?? [], sort), [query.data, sort]);

  const close = () => {
    // Leaving with the pressed option focused would block aria-hidden on web.
    blurActiveElement();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <RegionPickerView
      level={level}
      onSelectLevel={setLevel}
      projectStatus={status}
      onSelectProjectStatus={setStatus}
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
      onCompare={() => {
        blurActiveElement();
        // Replaces the picker, so going back from the comparison returns to where the picker was opened.
        router.replace(compareHref());
      }}
    />
  );
}
