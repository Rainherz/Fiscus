import { useRouter } from 'expo-router';

import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { DataFooter } from '@/shared/ui/DataFooter';

import { useLastIngestRun } from './hooks/queries';
import { useRepository } from './RepositoryContext';

export function DataFooterContainer() {
  const router = useRouter();
  const { isDemo } = useRepository();
  const lastRun = useLastIngestRun();
  return (
    <DataFooter
      finishedAt={lastRun.data?.finishedAt ?? null}
      isDemo={isDemo}
      onPressGuide={() => {
        blurActiveElement();
        router.push('/guia');
      }}
    />
  );
}
