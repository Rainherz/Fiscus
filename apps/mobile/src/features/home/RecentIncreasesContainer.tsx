import { useRecentCostIncreases, type ReadScope } from '@/features/investments/hooks/queries';

import { RecentIncreasesSection, type RecentIncreasesState } from './RecentIncreasesSection';

const RECENT_INCREASES_COUNT = 5;

interface Props {
  /** Department (undefined: all of Peru) and level of the list. */
  read: ReadScope;
  onPressInvestment: (cui: string) => void;
}

export function RecentIncreasesContainer({ read, onPressInvestment }: Props) {
  const increases = useRecentCostIncreases(read, RECENT_INCREASES_COUNT);
  const state: RecentIncreasesState =
    increases.status === 'success'
      ? { status: 'success', items: increases.data }
      : increases.status === 'error'
        ? { status: 'error', onRetry: () => increases.refetch() }
        : { status: 'pending' };
  return (
    <RecentIncreasesSection
      state={state}
      national={read.departmentCode === undefined}
      onPressInvestment={onPressInvestment}
    />
  );
}
