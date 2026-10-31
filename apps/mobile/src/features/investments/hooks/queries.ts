import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import type { LevelFilter } from '../domain/governmentLevel';
import type { ContractorSort } from '../domain/infobras';
import type { RankingKind } from '../domain/investment';
import type { StatusFilter } from '../domain/investmentStatus';
import { MAP_LIST_PAGE_SIZE, type MapListRequest, type MapPointsRequest } from '../domain/mapPoints';
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
 * What every read is limited to: a department (undefined: all of Peru), a government level
 * ('ALL': every level) and a project status ('ALL': active and closed). The entity drill-down adds
 * one entity. It is part of every query key.
 */
export interface ReadScope {
  departmentCode: number | undefined;
  level: LevelFilter;
  status: StatusFilter;
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
    queryFn: () => repository.functionSummaries(read.departmentCode, read.level, read.status),
  });
}

export function useSearchInvestments(text: string, read: ReadScope) {
  const { repository } = useRepository();
  const query = buildSearchQuery(text, read.departmentCode, read.level, read.status);
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

/** Last SSI success and open-data check: the footer and the stale-data banner. */
export function useDataFreshness() {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['data-freshness'],
    queryFn: () => repository.getDataFreshness(),
    staleTime: 30 * 60 * 1000,
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
        repository.countStalledInvestments(read.departmentCode, read.level, read.status),
        repository.getStalledInvestments({ ...read, page: 0, pageSize: count }),
      ]);
      return { total, items };
    },
  });
}

/** The project in the latest Contraloría edition of paralyzed works (null when absent). */
export function useParalyzedDetail(cui: string, options: { enabled?: boolean } = {}) {
  const { repository } = useRepository();
  return useQuery({
    enabled: options.enabled,
    queryKey: ['paralyzed-detail', cui],
    queryFn: () => repository.getParalyzedDetail(cui),
    staleTime: 60 * 60 * 1000,
  });
}

/** "Paralizadas (Contraloría)" ranking, paged. */
export function useParalyzedInvestments(read: ReadScope, options: { enabled?: boolean } = {}) {
  const { repository } = useRepository();
  return useInfiniteQuery({
    enabled: options.enabled,
    queryKey: ['paralyzed-investments', read],
    queryFn: ({ pageParam }) =>
      repository.getParalyzedInvestments({
        departmentCode: read.departmentCode,
        level: read.level,
        status: read.status,
        page: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => nextPageParam(last, all, PAGE_SIZE),
  });
}

/** "Paralizadas según la Contraloría" on the home screen: how many, the first few and the edition. */
export function useParalyzedPreview(read: ReadScope, count: number) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['paralyzed-preview', read, count],
    queryFn: async () => {
      const [total, items, edition] = await Promise.all([
        repository.countParalyzedInvestments(read.departmentCode, read.level, read.status),
        repository.getParalyzedInvestments({
          departmentCode: read.departmentCode,
          level: read.level,
          status: read.status,
          page: 0,
          pageSize: count,
        }),
        repository.getParalyzedEdition(),
      ]);
      return { total, items, edition };
    },
  });
}

/** Cut-off of the latest Contraloría edition (the footer's source line). */
export function useParalyzedEdition() {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['paralyzed-edition'],
    queryFn: () => repository.getParalyzedEdition(),
    staleTime: 60 * 60 * 1000,
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

/** "Regiones": every department of one level and status at once (25 rows), sorted on the client. */
export function useRegionComparison(level: LevelFilter, status: StatusFilter) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['region-comparison', level, status],
    queryFn: () => repository.getRegionComparison(level, status),
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
        status: read.status,
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

/**
 * The list beside the map, 30 projects a page ("Cargar más"). Like the map, the previous view's list
 * stays on screen while the next one loads; null asks for nothing.
 */
export function useMapList(request: Omit<MapListRequest, 'page' | 'pageSize'> | null) {
  const { repository } = useRepository();
  return useInfiniteQuery({
    queryKey: ['map-list', request],
    queryFn: ({ pageParam }) => repository.getMapList({ ...request!, page: pageParam, pageSize: MAP_LIST_PAGE_SIZE }),
    enabled: request !== null,
    initialPageParam: 0,
    getNextPageParam: (last, all) => (all.length * MAP_LIST_PAGE_SIZE < last.total ? all.length : undefined),
    placeholderData: keepPreviousData,
  });
}

/** The obras of a CUI in INFOBRAS and the date that data describes (detail screen block). */
export function useInfobrasDetail(cui: string) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['infobras-detail', cui],
    queryFn: async () => {
      const [works, dataAsOf] = await Promise.all([repository.getInfobrasWorks(cui), repository.getInfobrasDataAsOf()]);
      return { works, dataAsOf };
    },
    staleTime: 60 * 60 * 1000,
  });
}

/** The date the INFOBRAS data describes (the footer's source line). */
export function useInfobrasDataAsOf() {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['infobras-data-as-of'],
    queryFn: () => repository.getInfobrasDataAsOf(),
    staleTime: 60 * 60 * 1000,
  });
}

/** "Contratistas" ranking in a read scope, paged. */
export function useContractorRanking(sort: ContractorSort, read: ReadScope, options: { enabled?: boolean } = {}) {
  const { repository } = useRepository();
  return useInfiniteQuery({
    enabled: options.enabled,
    queryKey: ['contractor-ranking', sort, read],
    queryFn: ({ pageParam }) =>
      repository.getContractorRanking({
        sort,
        departmentCode: read.departmentCode,
        level: read.level,
        status: read.status,
        page: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (all.length * PAGE_SIZE < last.total ? all.length : undefined),
  });
}

/** One contractor's national totals. */
export function useContractorSummary(ruc: string) {
  const { repository } = useRepository();
  return useQuery({
    queryKey: ['contractor-summary', ruc],
    queryFn: () => repository.getContractorSummary(ruc),
  });
}

/** One contractor's obras, paged. */
export function useContractorWorks(ruc: string) {
  const { repository } = useRepository();
  return useInfiniteQuery({
    queryKey: ['contractor-works', ruc],
    queryFn: ({ pageParam }) => repository.getContractorWorks({ ruc, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => nextPageParam(last, all, PAGE_SIZE),
  });
}
