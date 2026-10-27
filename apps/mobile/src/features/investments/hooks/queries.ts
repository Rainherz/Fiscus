import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import type { RankingKind } from '../domain/investment';
import {
  PAGE_SIZE,
  buildFunctionQuery,
  buildRankingQuery,
  buildSearchQuery,
} from '../domain/queries';
import { useRepository } from '../RepositoryContext';
import { nextPageParam } from './pagination';

/** Hero + "Ranking de aumentos" on the home screen. */
export function useTopIncreases(departmentCode: number, count: number) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['top-increases', departmentCode, count],
    queryFn: () =>
      repository.findMany(
        buildRankingQuery({ kind: 'increase-amount', departmentCode, page: 0, pageSize: count }),
      ),
  });
}

export function useRanking(kind: RankingKind, departmentCode: number) {
  const { repository } = useRepository();
  return useInfiniteQuery({
    queryKey: ['ranking', kind, departmentCode],
    queryFn: ({ pageParam }) =>
      repository.findMany(buildRankingQuery({ kind, departmentCode, page: pageParam })),
    initialPageParam: 0,
    getNextPageParam: (last, all) => nextPageParam(last, all, PAGE_SIZE),
  });
}

export function useFunctionInvestments(departmentCode: number, fn: string | null) {
  const { repository } = useRepository();
  return useInfiniteQuery({
    queryKey: ['function-investments', departmentCode, fn],
    queryFn: ({ pageParam }) =>
      repository.findMany(buildFunctionQuery({ departmentCode, fn, page: pageParam })),
    initialPageParam: 0,
    getNextPageParam: (last, all) => nextPageParam(last, all, PAGE_SIZE),
  });
}

export function useFunctionSummaries(departmentCode: number) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['function-summaries', departmentCode],
    queryFn: () => repository.functionSummaries(departmentCode),
  });
}

export function useSearchInvestments(text: string, departmentCode: number) {
  const { repository } = useRepository();
  const query = buildSearchQuery(text, departmentCode);
  return {
    isSearchable: query !== null,
    ...useQuery({
      queryKey: ['search', query],
      queryFn: () => repository.findMany(query!),
      enabled: query !== null,
    }),
  };
}

export function useInvestment(cui: string) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['investment', cui],
    queryFn: () => repository.findByCui(cui),
  });
}

export function useLastIngestRun() {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['last-ingest-run'],
    queryFn: () => repository.lastIngestRun(),
    staleTime: 60 * 60 * 1000,
  });
}
