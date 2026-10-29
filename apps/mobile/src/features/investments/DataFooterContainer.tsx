import { useRouter } from 'expo-router';

import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { DataFooter } from '@/shared/ui/DataFooter';

import { useDataFreshness } from './hooks/queries';
import { useRepository } from './RepositoryContext';

export function DataFooterContainer() {
  const router = useRouter();
  const { isDemo } = useRepository();
  const freshness = useDataFreshness();
  return (
    <DataFooter
      finishedAt={freshness.data?.ssiLastSuccessAt ?? null}
      openDataCheckedAt={freshness.data?.openDataCheckedAt ?? null}
      isDemo={isDemo}
      onPressGuide={() => {
        blurActiveElement();
        router.push('/guia');
      }}
    />
  );
}
