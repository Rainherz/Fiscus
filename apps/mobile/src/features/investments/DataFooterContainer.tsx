import { useRouter } from 'expo-router';

import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { DataFooter } from '@/shared/ui/DataFooter';

import { infobrasSourceName } from '@/features/infobras/infobrasPresentation';
import { paralyzedSourceName } from '@/features/paralyzed/paralyzedPresentation';

import { useDataFreshness, useInfobrasDataAsOf, useParalyzedEdition } from './hooks/queries';
import { useRepository } from './RepositoryContext';

export function DataFooterContainer() {
  const router = useRouter();
  const { isDemo } = useRepository();
  const freshness = useDataFreshness();
  const edition = useParalyzedEdition();
  const infobrasDataAsOf = useInfobrasDataAsOf();
  return (
    <DataFooter
      finishedAt={freshness.data?.ssiLastSuccessAt ?? null}
      openDataCheckedAt={freshness.data?.openDataCheckedAt ?? null}
      isDemo={isDemo}
      paralyzedSource={paralyzedSourceName(edition.data?.editionCutoff ?? null)}
      infobrasSource={infobrasSourceName(infobrasDataAsOf.data ?? null)}
      onPressGuide={() => {
        blurActiveElement();
        router.push('/guia');
      }}
    />
  );
}
