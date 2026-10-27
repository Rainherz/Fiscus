import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useReadScope, useScope } from '@/features/department/ScopeContext';
import { useSearchInvestments } from '@/features/investments/hooks/queries';

import { SearchView } from './SearchView';
import { useDebouncedValue } from './useDebouncedValue';

const DEBOUNCE_MS = 350;

export function SearchContainer() {
  const router = useRouter();
  const { label, levelLabel } = useScope();
  const read = useReadScope();
  const code = read.departmentCode;
  const [text, setText] = useState('');
  const debounced = useDebouncedValue(text, DEBOUNCE_MS);
  const search = useSearchInvestments(debounced, read);

  const status = !search.isSearchable ? 'idle' : search.status;

  return (
    <SearchView
      text={text}
      departmentName={code === undefined ? null : label}
      levelLabel={read.level === 'ALL' ? null : levelLabel}
      results={search.data ?? []}
      status={status}
      onChangeText={setText}
      onRetry={() => search.refetch()}
      onPressInvestment={(cui) => router.push({ pathname: '/investment/[cui]', params: { cui } })}
    />
  );
}
