import { useMemo } from 'react';

import { useRegionComparison } from '@/features/investments/hooks/queries';

import { TopRegionsSection, topRegionsByIncrease, type TopRegionsState } from './TopRegionsSection';

interface Props {
  onPressRegion: (departmentCode: number) => void;
  onPressSeeAll: () => void;
  onPressCompare: () => void;
}

export function TopRegionsContainer({ onPressRegion, onPressSeeAll, onPressCompare }: Props) {
  const comparison = useRegionComparison();
  const top = useMemo(() => topRegionsByIncrease(comparison.data ?? []), [comparison.data]);
  const state: TopRegionsState =
    comparison.status === 'success'
      ? { status: 'success', regions: top }
      : comparison.status === 'error'
        ? { status: 'error', onRetry: () => comparison.refetch() }
        : { status: 'pending' };
  return (
    <TopRegionsSection
      state={state}
      onPressRegion={onPressRegion}
      onPressSeeAll={onPressSeeAll}
      onPressCompare={onPressCompare}
    />
  );
}
