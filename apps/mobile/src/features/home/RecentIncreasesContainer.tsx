import { useRecentCostIncreases } from '@/features/investments/hooks/queries';

import { RecentIncreasesSection, type RecentIncreasesState } from './RecentIncreasesSection';

const RECENT_INCREASES_COUNT = 5;

interface Props {
  /** Undefined lists all of Peru. */
  departmentCode: number | undefined;
  onPressInvestment: (cui: string) => void;
}

export function RecentIncreasesContainer({ departmentCode, onPressInvestment }: Props) {
  const increases = useRecentCostIncreases(departmentCode, RECENT_INCREASES_COUNT);
  const state: RecentIncreasesState =
    increases.status === 'success'
      ? { status: 'success', items: increases.data }
      : increases.status === 'error'
        ? { status: 'error', onRetry: () => increases.refetch() }
        : { status: 'pending' };
  return (
    <RecentIncreasesSection
      state={state}
      national={departmentCode === undefined}
      onPressInvestment={onPressInvestment}
    />
  );
}
