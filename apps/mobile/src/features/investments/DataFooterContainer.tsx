import { useRouter } from 'expo-router';

import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { DataFooter } from '@/shared/ui/DataFooter';

import { paralyzedSourceName } from '@/features/paralyzed/paralyzedPresentation';

import { useDataFreshness, useParalyzedEdition } from './hooks/queries';
import { useRepository } from './RepositoryContext';

export function DataFooterContainer() {
  const router = useRouter();
  const { isDemo } = useRepository();
  const freshness = useDataFreshness();
  const edition = useParalyzedEdition();
  return (
    <DataFooter
      finishedAt={freshness.data?.ssiLastSuccessAt ?? null}
      openDataCheckedAt={freshness.data?.openDataCheckedAt ?? null}
      isDemo={isDemo}
      paralyzedSource={paralyzedSourceName(edition.data?.editionCutoff ?? null)}
      onPressGuide={() => {
        blurActiveElement();
        router.push('/guia');
      }}
    />
  );
}
