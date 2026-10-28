import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import type { LevelFilter } from '../domain/governmentLevel';
import type { RankingKind } from '../domain/investment';
import type { MapPointsRequest } from '../domain/mapPoints';
import {
  PAGE_SIZE,
  buildFunctionQuery,
  buildRankingQuery,
  buildSearchQuery,
} from '../domain/queries';
import type { RegionSort } from '../domain/regionComparison';
import { useRepository } from '../RepositoryContext';
import { nextPageParam } from './pagination';

/**
 * What every read is limited to: a department (undefined: all of Peru) and a government level
 * ('ALL': every level). The entity drill-down adds one entity. It is part of every query key.
 */
export interface ReadScope {
  departmentCode: number | undefined;
  level: LevelFilter;
  entity?: string;
}

/** Hero + "Ranking de aumentos" on the home screen. */
export function useTopIncreases(read: ReadScope, count: number) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['top-increases', read, count],
    queryFn: () =>
      repository.findMany(buildRankingQuery({ kind: 'increase-amount', ...read, page: 0, pageSize: count })),
  });
}

export function useRanking(kind: RankingKind, read: ReadScope, options: { enabled?: boolean } = {}) {
  const { repository } = useRepository();
  return useInfiniteQuery({
    enabled: options.enabled,
    queryKey: ['ranking', kind, read],
    queryFn: ({ pageParam }) => repository.findMany(buildRankingQuery({ kind, ...read, page: pageParam })),
    initialPageParam: 0,
    getNextPageParam: (last, all) => nextPageParam(last, all, PAGE_SIZE),
  });
}

export function useFunctionInvestments(read: ReadScope, fn: string | null) {
  const { repository } = useRepository();
  return useInfiniteQuery({
    queryKey: ['function-investments', read, fn],
    queryFn: ({ pageParam }) => repository.findMany(buildFunctionQuery({ ...read, fn, page: pageParam })),
    initialPageParam: 0,
    getNextPageParam: (last, all) => nextPageParam(last, all, PAGE_SIZE),
  });
}

export function useFunctionSummaries(read: ReadScope) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['function-summaries', read],
    queryFn: () => repository.functionSummaries(read.departmentCode, read.level),
  });
}

export function useSearchInvestments(text: string, read: ReadScope) {
  const { repository } = useRepository();
  const query = buildSearchQuery(text, read.departmentCode, read.level);
  return {
    isSearchable: query !== null,
    ...useQuery({
      queryKey: ['search', query],
      queryFn: () => repository.findMany(query!),
      enabled: query !== null,
    }),
  };
}

export function useInvestment(cui: string, options: { enabled?: boolean } = {}) {
  const { repository } = useRepository();
  return useQuery({
    enabled: options.enabled,
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

/** "Historial del costo" on the detail screen. */
export function useCostHistory(cui: string) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['cost-history', cui],
    queryFn: () => repository.getCostHistory(cui),
  });
}

/** "Aumentos recientes" on the home screen. */
export function useRecentCostIncreases(read: ReadScope, limit: number) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['recent-cost-increases', read, limit],
    queryFn: () => repository.getRecentCostIncreases({ ...read, limit }),
  });
}

/** "Sin gasto reciente" ranking, paged. */
export function useStalledInvestments(read: ReadScope, options: { enabled?: boolean } = {}) {
  const { repository } = useRepository();
  return useInfiniteQuery({
    enabled: options.enabled,
    queryKey: ['stalled-investments', read],
    queryFn: ({ pageParam }) => repository.getStalledInvestments({ ...read, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => nextPageParam(last, all, PAGE_SIZE),
  });
}

/** "Sin gasto reciente" block on the home screen: how many, and the first few. */
export function useStalledPreview(read: ReadScope, count: number) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['stalled-preview', read, count],
    queryFn: async () => {
      const [total, items] = await Promise.all([
        repository.countStalledInvestments(read.departmentCode, read.level),
        repository.getStalledInvestments({ ...read, page: 0, pageSize: count }),
      ]);
      return { total, items };
    },
  });
}

/** Latest accrual month of the dataset: the end of the "Sin gasto reciente" window. */
export function useAccrualReferenceMonth() {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['accrual-reference-month'],
    queryFn: () => repository.getAccrualReferenceMonth(),
    staleTime: 60 * 60 * 1000,
  });
}

/** "Regiones": every department of one level at once (25 rows), sorted on the client. */
export function useRegionComparison(level: LevelFilter) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['region-comparison', level],
    queryFn: () => repository.getRegionComparison(level),
  });
}

/** "Entidades": thousands of entities nationwide, so the view sorts and pages them. */
export function useEntityComparison(sort: RegionSort, read: ReadScope, options: { enabled?: boolean } = {}) {
  const { repository } = useRepository();
  return useInfiniteQuery({
    enabled: options.enabled,
    queryKey: ['entity-comparison', sort, read],
    queryFn: ({ pageParam }) =>
      repository.getEntityComparison({
        sort,
        departmentCode: read.departmentCode,
        level: read.level,
        page: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => nextPageParam(last, all, PAGE_SIZE),
  });
}

/**
 * The map view (clusters or points). The previous view stays on screen while the next one loads;
 * null asks for nothing (the view is outside Peru).
 */
export function useMapPoints(request: MapPointsRequest | null) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['map-points', request],
    queryFn: () => repository.getMapPoints(request!),
    enabled: request !== null,
    placeholderData: keepPreviousData,
  });
}
