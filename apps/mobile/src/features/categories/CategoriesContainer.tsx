import { useRouter } from 'expo-router';

import { useReadScope } from '@/features/department/ScopeContext';
import { levelScopeNote } from '@/features/government-level/levelPresentation';
import { useFunctionSummaries } from '@/features/investments/hooks/queries';

import { CategoriesView } from './CategoriesView';
import { encodeFunctionParam } from './functionParam';

export function CategoriesContainer() {
  const router = useRouter();
  const read = useReadScope();
  const summaries = useFunctionSummaries(read);

  return (
    <CategoriesView
      summaries={summaries.data ?? []}
      status={summaries.status}
      levelNote={levelScopeNote(read.level)}
      onRetry={() => summaries.refetch()}
      onPressCategory={(fn) =>
        router.push({ pathname: '/category/[fn]', params: { fn: encodeFunctionParam(fn) } })
      }
    />
  );
}
