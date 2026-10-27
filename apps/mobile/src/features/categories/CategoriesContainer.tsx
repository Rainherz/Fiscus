import { useRouter } from 'expo-router';

import { useDepartment } from '@/features/department/DepartmentContext';
import { useFunctionSummaries } from '@/features/investments/hooks/queries';

import { CategoriesView } from './CategoriesView';
import { encodeFunctionParam } from './functionParam';

export function CategoriesContainer() {
  const router = useRouter();
  const { code } = useDepartment();
  const summaries = useFunctionSummaries(code);

  return (
    <CategoriesView
      summaries={summaries.data ?? []}
      status={summaries.status}
      onRetry={() => summaries.refetch()}
      onPressCategory={(fn) =>
        router.push({ pathname: '/category/[fn]', params: { fn: encodeFunctionParam(fn) } })
      }
    />
  );
}
