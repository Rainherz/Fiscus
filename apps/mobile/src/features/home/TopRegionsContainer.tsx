import { useMemo } from 'react';

import type { LevelFilter } from '@/features/investments/domain/governmentLevel';
import type { StatusFilter } from '@/features/investments/domain/investmentStatus';
import { useRegionComparison } from '@/features/investments/hooks/queries';

import { regionsNote } from '@/features/government-level/levelPresentation';
import { TopRegionsSection, topRegionsByIncrease, type TopRegionsState } from './TopRegionsSection';

interface Props {
  level: LevelFilter;
  status: StatusFilter;
  onPressRegion: (departmentCode: number) => void;
  onPressSeeAll: () => void;
  onPressCompare: () => void;
}

export function TopRegionsContainer({ level, status, onPressRegion, onPressSeeAll, onPressCompare }: Props) {
  const comparison = useRegionComparison(level, status);
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
      note={regionsNote(level, status)}
      onPressRegion={onPressRegion}
      onPressSeeAll={onPressSeeAll}
      onPressCompare={onPressCompare}
    />
  );
}
