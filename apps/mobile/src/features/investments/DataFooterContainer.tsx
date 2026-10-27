import { DataFooter } from '@/shared/ui/DataFooter';

import { useLastIngestRun } from './hooks/queries';
import { useRepository } from './RepositoryContext';

export function DataFooterContainer() {
  const { isDemo } = useRepository();
  const lastRun = useLastIngestRun();
  return <DataFooter finishedAt={lastRun.data?.finishedAt ?? null} isDemo={isDemo} />;
}
