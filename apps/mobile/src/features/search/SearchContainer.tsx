import { useRouter } from 'expo-router';
import { useState } from 'react';

import { departmentCodeOf } from '@/features/department/scope';
import { useScope } from '@/features/department/ScopeContext';
import { useSearchInvestments } from '@/features/investments/hooks/queries';

import { SearchView } from './SearchView';
import { useDebouncedValue } from './useDebouncedValue';

const DEBOUNCE_MS = 350;

export function SearchContainer() {
  const router = useRouter();
  const { scope, label } = useScope();
  const code = departmentCodeOf(scope);
  const [text, setText] = useState('');
  const debounced = useDebouncedValue(text, DEBOUNCE_MS);
  const search = useSearchInvestments(debounced, code);

  const status = !search.isSearchable ? 'idle' : search.status;

  return (
    <SearchView
      text={text}
      departmentName={code === undefined ? null : label}
      results={search.data ?? []}
      status={status}
      onChangeText={setText}
      onRetry={() => search.refetch()}
      onPressInvestment={(cui) => router.push({ pathname: '/investment/[cui]', params: { cui } })}
    />
  );
}
