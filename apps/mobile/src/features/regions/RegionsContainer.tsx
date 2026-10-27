import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';

import { useDepartment } from '@/features/department/DepartmentContext';
import { rankRegions, type RegionSort } from '@/features/investments/domain/regionComparison';
import { useRegionComparison } from '@/features/investments/hooks/queries';

import { goToRegion } from './goToRegion';
import { isRegionSort } from './regionPresentation';
import { RegionsView } from './RegionsView';

const DEFAULT_SORT: RegionSort = 'increase-amount';

/** The sort lives in the route (`/rankings?tab=regions&sort=stalled`), like the Rankings tab. */
export function RegionsContainer() {
  const router = useRouter();
  const { setCode } = useDepartment();
  const params = useLocalSearchParams<{ sort?: string }>();
  const sort: RegionSort = isRegionSort(params.sort) ? params.sort : DEFAULT_SORT;
  const query = useRegionComparison();
  const regions = useMemo(() => rankRegions(query.data ?? [], sort), [query.data, sort]);

  return (
    <RegionsView
      sort={sort}
      regions={regions}
      status={query.status}
      onSelectTab={(tab) => router.setParams({ tab, sort: undefined })}
      onSelectSort={(next) => router.setParams({ sort: next })}
      onRetry={() => query.refetch()}
      onPressRegion={(code) => goToRegion(code, { setCode, navigateHome: () => router.navigate('/') })}
    />
  );
}
