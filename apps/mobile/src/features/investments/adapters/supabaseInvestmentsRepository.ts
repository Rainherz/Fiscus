import type { SupabaseClient } from '@supabase/supabase-js';

import {
  COST_CHANGE_COLUMNS,
  ENTITY_COMPARISON_COLUMNS,
  INVESTMENT_COLUMNS,
  REGION_COMPARISON_COLUMNS,
  STALLED_INVESTMENT_COLUMNS,
  mapCostChangeRow,
  mapEntityComparisonRow,
  mapFunctionSummaryRow,
  mapIngestRunRow,
  mapMapListRows,
  mapMapPointRows,
  mapInvestmentRow,
  mapRecentCostIncreaseRow,
  mapRegionComparisonRow,
  mapStalledInvestmentRow,
  type CostChangeRow,
  type EntityComparisonRow,
  type FunctionSummaryRow,
  type IngestRunRow,
  type MapListRow,
  type MapPointRow,
  type InvestmentRow,
  type RecentCostIncreaseRow,
  type RegionComparisonRow,
  type StalledInvestmentRow,
} from '../domain/mappers';
import { mapDataFreshnessRows, type DataFreshnessRow } from '../domain/freshness';
import type { LevelFilter } from '../domain/governmentLevel';
import { MAP_LIST_PAGE_SIZE, type MapFilter } from '../domain/mapPoints';
import { buildEntityQuery, buildStalledQuery, type Filter, type InvestmentQuery } from '../domain/queries';
import type { InvestmentsRepository } from '../ports/InvestmentsRepository';

/** Minimal structural view of a PostgREST filter builder, so filters compose without generics noise. */
interface FilterBuilder {
  eq(column: string, value: unknown): FilterBuilder;
  gt(column: string, value: unknown): FilterBuilder;
  gte(column: string, value: unknown): FilterBuilder;
  ilike(column: string, pattern: string): FilterBuilder;
  not(column: string, operator: string, value: unknown): FilterBuilder;
  is(column: string, value: null): FilterBuilder;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): FilterBuilder;
  range(from: number, to: number): FilterBuilder;
  limit(count: number): FilterBuilder;
  maybeSingle<T>(): PromiseLike<Result<T | null>>;
  then<R>(onfulfilled: (value: Result<unknown>) => R): PromiseLike<R>;
}

interface Result<T> {
  data: T | null;
  error: { message: string } | null;
  /** Present when the select asked for a count. */
  count?: number | null;
}

/** The `only_*` arguments of map_points and map_list. */
function filterArguments(filters: readonly MapFilter[]) {
  return {
    only_increase: filters.includes('increase'),
    only_stalled: filters.includes('stalled'),
    only_overspent: filters.includes('overspent'),
  };
}

function applyFilter(builder: FilterBuilder, filter: Filter<string>): FilterBuilder {
  switch (filter.op) {
    case 'eq':
      return builder.eq(filter.column, filter.value);
    case 'gt':
      return builder.gt(filter.column, filter.value);
    case 'gte':
      return builder.gte(filter.column, filter.value);
    case 'ilike':
      return builder.ilike(filter.column, filter.value);
    case 'notNull':
      return builder.not(filter.column, 'is', null);
    case 'isNull':
      return builder.is(filter.column, null);
  }
}

function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/** Filters, order (nulls last) and range of a query spec, applied to any table or view. */
function applyQuery<C extends string>(builder: FilterBuilder, query: InvestmentQuery<C>): FilterBuilder {
  let result = query.filters.reduce(applyFilter, builder);
  for (const order of query.order) {
    result = result.order(order.column, { ascending: order.ascending, nullsFirst: false });
  }
  return result.range(query.range.from, query.range.to);
}

export function createSupabaseInvestmentsRepository(client: SupabaseClient): InvestmentsRepository {
  const table = (name: string) =>
    client.from(name).select(name === 'investments' ? INVESTMENT_COLUMNS : '*') as unknown as FilterBuilder;
  const costChanges = (columns: string) =>
    client.from('investment_cost_changes').select(columns) as unknown as FilterBuilder;
  // Every view read goes through the level-aware views; the GR-only ones are kept for other readers.
  const stalled = (columns: string, options?: { count: 'exact'; head: true }) =>
    (options
      ? client.from('stalled_investments_by_level').select(columns, options)
      : client.from('stalled_investments_by_level').select(columns)) as unknown as FilterBuilder;
  /** Only one level, unless every level is asked for. */
  const atLevel = (builder: FilterBuilder, column: string, level: LevelFilter = 'ALL') =>
    level === 'ALL' ? builder : builder.eq(column, level);

  return {
    async findMany(query: InvestmentQuery) {
      const rows = unwrap((await applyQuery(table('investments'), query)) as Result<InvestmentRow[]>);
      return (rows ?? []).map(mapInvestmentRow);
    },
    async findByCui(cui) {
      const row = unwrap(await table('investments').eq('cui', cui).maybeSingle<InvestmentRow>());
      return row ? mapInvestmentRow(row) : null;
    },
    async functionSummaries(departmentCode, level = 'ALL') {
      // The *_by_level views have one row per level plus an 'ALL' row, so the level is always filtered.
      const source =
        departmentCode === undefined
          ? table('function_summary_by_level').eq('government_level', level)
          : table('department_function_summary_by_level')
              .eq('government_level', level)
              .eq('department_code', departmentCode);
      const rows = unwrap(
        (await source
          .order('total_updated_cost', { ascending: false, nullsFirst: false })) as Result<
          FunctionSummaryRow[]
        >,
      );
      return (rows ?? []).map(mapFunctionSummaryRow);
    },
    async lastIngestRun() {
      const row = unwrap(
        await table('ingest_runs')
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle<IngestRunRow>(),
      );
      return row ? mapIngestRunRow(row) : null;
    },
    async getDataFreshness() {
      const rows = unwrap(
        (await (client.from('data_freshness').select('source, last_success_at, last_checked_at') as unknown as FilterBuilder)) as Result<
          DataFreshnessRow[]
        >,
      );
      return mapDataFreshnessRows(rows ?? []);
    },
    async getCostHistory(cui) {
      const rows = unwrap(
        (await costChanges(COST_CHANGE_COLUMNS)
          .eq('cui', cui)
          .order('observed_at', { ascending: true })
          .order('id', { ascending: true })) as Result<CostChangeRow[]>,
      );
      return (rows ?? []).map(mapCostChangeRow);
    },
    async getRecentCostIncreases({ departmentCode, level, limit }) {
      // `!inner` turns the embedded investment into a join, so its filters drop other departments and levels.
      const increases = costChanges(`${COST_CHANGE_COLUMNS},investments!inner(name,department_code,government_level)`)
        .eq('change_kind', 'changed')
        .gt('updated_cost_delta', 0);
      const scoped = atLevel(
        departmentCode === undefined ? increases : increases.eq('investments.department_code', departmentCode),
        'investments.government_level',
        level,
      );
      const rows = unwrap(
        (await scoped
          .order('observed_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit)) as Result<RecentCostIncreaseRow[]>,
      );
      return (rows ?? []).map(mapRecentCostIncreaseRow);
    },
    async getStalledInvestments(params) {
      const rows = unwrap(
        (await applyQuery(stalled(STALLED_INVESTMENT_COLUMNS), buildStalledQuery(params))) as Result<
          StalledInvestmentRow[]
        >,
      );
      return (rows ?? []).map(mapStalledInvestmentRow);
    },
    async countStalledInvestments(departmentCode, level) {
      const all = stalled('cui', { count: 'exact', head: true });
      const result = (await atLevel(
        departmentCode === undefined ? all : all.eq('department_code', departmentCode),
        'government_level',
        level,
      )) as Result<unknown>;
      unwrap(result);
      return result.count ?? 0;
    },
    async getAccrualReferenceMonth() {
      const row = unwrap(
        await (client.from('accrual_reference_month_all_levels').select('reference_month') as unknown as FilterBuilder)
          .maybeSingle<{ reference_month: string | null }>(),
      );
      return row?.reference_month ?? null;
    },
    async getRegionComparison(level = 'ALL') {
      const rows = unwrap(
        (await (client.from('region_comparison_by_level').select(REGION_COMPARISON_COLUMNS) as unknown as FilterBuilder)
          .eq('government_level', level)
          .order('department_code', { ascending: true })) as Result<RegionComparisonRow[]>,
      );
      return (rows ?? []).map(mapRegionComparisonRow);
    },
    async getEntityComparison(params) {
      const source = client.from('entity_comparison').select(ENTITY_COMPARISON_COLUMNS) as unknown as FilterBuilder;
      const rows = unwrap((await applyQuery(source, buildEntityQuery(params))) as Result<EntityComparisonRow[]>);
      return (rows ?? []).map(mapEntityComparisonRow);
    },
    async getMapPoints({ bbox, zoom, level, departmentCode, filters }) {
      const result = (await client.rpc('map_points', {
        min_lat: bbox.minLat,
        min_lon: bbox.minLon,
        max_lat: bbox.maxLat,
        max_lon: bbox.maxLon,
        zoom,
        level,
        department: departmentCode ?? null,
        // Without filters, the arguments of the original function (older deployments accept them).
        ...(filters?.length ? filterArguments(filters) : {}),
      })) as Result<MapPointRow[]>;
      return mapMapPointRows(unwrap(result) ?? []);
    },
    async getMapList({ bbox, level, departmentCode, filters = [], page, pageSize = MAP_LIST_PAGE_SIZE }) {
      const result = (await client.rpc('map_list', {
        min_lat: bbox.minLat,
        min_lon: bbox.minLon,
        max_lat: bbox.maxLat,
        max_lon: bbox.maxLon,
        level,
        department: departmentCode ?? null,
        ...filterArguments(filters),
        page_limit: pageSize,
        page_offset: page * pageSize,
      })) as Result<MapListRow[]>;
      return mapMapListRows(unwrap(result) ?? []);
    },
  };
}
