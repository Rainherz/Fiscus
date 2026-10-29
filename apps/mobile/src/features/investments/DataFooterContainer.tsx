import { DataFooter } from '@/shared/ui/DataFooter';

import { useDataFreshness } from './hooks/queries';
import { useRepository } from './RepositoryContext';

export function DataFooterContainer() {
  const { isDemo } = useRepository();
  const freshness = useDataFreshness();
  return (
    <DataFooter
      finishedAt={freshness.data?.ssiLastSuccessAt ?? null}
      openDataCheckedAt={freshness.data?.openDataCheckedAt ?? null}
      isDemo={isDemo}
    />
  );
}
