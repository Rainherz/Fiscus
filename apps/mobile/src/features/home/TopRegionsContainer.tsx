import { useMemo } from 'react';

import type { LevelFilter } from '@/features/investments/domain/governmentLevel';
import { useRegionComparison } from '@/features/investments/hooks/queries';

import { regionsNote } from '@/features/government-level/levelPresentation';
import { TopRegionsSection, topRegionsByIncrease, type TopRegionsState } from './TopRegionsSection';

interface Props {
  level: LevelFilter;
  onPressRegion: (departmentCode: number) => void;
  onPressSeeAll: () => void;
  onPressCompare: () => void;
}

export function TopRegionsContainer({ level, onPressRegion, onPressSeeAll, onPressCompare }: Props) {
  const comparison = useRegionComparison(level);
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
      note={regionsNote(level)}
      onPressRegion={onPressRegion}
      onPressSeeAll={onPressSeeAll}
      onPressCompare={onPressCompare}
    />
  );
}
