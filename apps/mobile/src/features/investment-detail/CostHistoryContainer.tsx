import { useCostHistory } from '@/features/investments/hooks/queries';

import { CostHistorySection, type CostHistoryState } from './CostHistorySection';

export function CostHistoryContainer({ cui }: { cui: string }) {
  const history = useCostHistory(cui);
  const state: CostHistoryState =
    history.status === 'success'
      ? { status: 'success', changes: history.data }
      : history.status === 'error'
        ? { status: 'error', onRetry: () => history.refetch() }
        : { status: 'pending' };
  return <CostHistorySection state={state} />;
}
