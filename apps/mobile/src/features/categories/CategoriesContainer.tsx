import { useRouter } from 'expo-router';

import { departmentCodeOf } from '@/features/department/scope';
import { useScope } from '@/features/department/ScopeContext';
import { useFunctionSummaries } from '@/features/investments/hooks/queries';

import { CategoriesView } from './CategoriesView';
import { encodeFunctionParam } from './functionParam';

export function CategoriesContainer() {
  const router = useRouter();
  const code = departmentCodeOf(useScope().scope);
  const summaries = useFunctionSummaries(code);

  return (
    <CategoriesView
      summaries={summaries.data ?? []}
      status={summaries.status}
      national={code === undefined}
      onRetry={() => summaries.refetch()}
      onPressCategory={(fn) =>
        router.push({ pathname: '/category/[fn]', params: { fn: encodeFunctionParam(fn) } })
      }
    />
  );
}
