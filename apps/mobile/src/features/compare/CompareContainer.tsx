import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScope } from '@/features/department/ScopeContext';
import { useRegionComparison, useTopIncreases } from '@/features/investments/hooks/queries';
import { blurActiveElement } from '@/shared/navigation/blurActiveElement';

import { needsComparisonData, parseRegionCode, resolvePair, swapPair, type RegionPair } from './compareSelection';
import { CompareView, type BiggestIncreaseState } from './CompareView';

function useBiggestIncrease(code: number | undefined): BiggestIncreaseState {
  // The increase ranking cut to one row: the same query as the home hero, per department.
  const query = useTopIncreases(code, 1);
  if (code === undefined || query.status === 'pending') return { status: 'pending' };
  if (query.status === 'error') return { status: 'error' };
  return { status: 'success', investment: query.data[0] ?? null };
}

/**
 * "Comparar regiones" (`/compare?a=4&b=8`). Missing or unknown codes are replaced by defaults,
 * written back to the URL so it can be shared. Choosing here never changes the app's scope.
 */
export function CompareContainer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scope } = useScope();
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const requested = { a: parseRegionCode(params.a), b: parseRegionCode(params.b) };
  const query = useRegionComparison();
  const regions = useMemo(() => query.data ?? [], [query.data]);

  const waiting = needsComparisonData(requested) && query.status === 'pending';
  const pair: RegionPair | null = waiting ? null : resolvePair({ ...requested, scope, regions });

  const a = pair ? String(pair.a) : undefined;
  const b = pair ? String(pair.b) : undefined;
  useEffect(() => {
    if (a !== undefined && b !== undefined && (params.a !== a || params.b !== b)) router.setParams({ a, b });
  }, [a, b, params.a, params.b, router]);

  const biggestA = useBiggestIncrease(pair?.a);
  const biggestB = useBiggestIncrease(pair?.b);

  const setPair = (next: RegionPair) => router.setParams({ a: String(next.a), b: String(next.b) });

  return (
    <CompareView
      pair={pair}
      status={query.status}
      regions={regions}
      biggest={{ a: biggestA, b: biggestB }}
      onSelect={(side, code) => pair && setPair({ ...pair, [side]: code })}
      onSwap={() => pair && setPair(swapPair(pair))}
      onRetry={() => query.refetch()}
      onBack={() => {
        blurActiveElement();
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
      onPressInvestment={(cui) => {
        blurActiveElement();
        router.push({ pathname: '/investment/[cui]', params: { cui } });
      }}
      topInset={insets.top}
      bottomInset={insets.bottom}
    />
  );
}
