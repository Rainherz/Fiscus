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
import {
  CONTRACTOR_SUMMARY_COLUMNS,
  CONTRACTOR_WORK_COLUMNS,
  INFOBRAS_FRESHNESS_SOURCE,
  INFOBRAS_WORK_COLUMNS,
  INFOBRAS_WORKS_LIMIT,
  mapContractorRankingRows,
  mapContractorSummaryRow,
  mapContractorWorkRow,
  mapInfobrasWorkRow,
  type ContractorRankingRow,
  type ContractorSummaryRow,
  type ContractorWorkRow,
  type InfobrasWorkRow,
} from '../domain/infobras';
import type { LevelFilter } from '../domain/governmentLevel';
import { statusValueOf, type StatusFilter } from '../domain/investmentStatus';
import { MAP_LIST_PAGE_SIZE, type MapFilter } from '../domain/mapPoints';
import {
  PARALYZED_INVESTMENT_COLUMNS,
  PARALYZED_SUMMARY_COLUMNS,
  PARALYZED_WORK_COLUMNS,
  mapParalyzedInvestmentRow,
  mapParalyzedSummaryRow,
  mapParalyzedWorkRow,
  type ParalyzedInvestmentRow,
  type ParalyzedSummaryRow,
  type ParalyzedWorkRow,
} from '../domain/paralyzed';
import {
  PAGE_SIZE,
  buildEntityQuery,
  buildParalyzedQuery,
  buildStalledQuery,
  type Filter,
  type InvestmentQuery,
} from '../domain/queries';
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

/** The status_filter argument of map_points and map_list; absent when no status is asked for. */
function statusArgument(status: StatusFilter | undefined) {
  return status === undefined ? {} : { status_filter: status };
}

/**
 * The `only_*` arguments of map_points and map_list. only_paralyzed is sent only when on, so calls
 * without it match the functions of deployments before the paralyzed-works migration.
 */
function filterArguments(filters: readonly MapFilter[]) {
  return {
    only_increase: filters.includes('increase'),
    only_stalled: filters.includes('stalled'),
    only_overspent: filters.includes('overspent'),
    ...(filters.includes('paralyzed') ? { only_paralyzed: true } : {}),
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
  /** Only one MEF status, unless every status is asked for. */
  const withStatus = (builder: FilterBuilder, column: string, status: StatusFilter | undefined) => {
    const value = statusValueOf(status);
    return value === null ? builder : builder.eq(column, value);
  };
  /** One status group of a *_by_status view, or the view without statuses when none is asked for. */
  const byStatus = (view: string, status: StatusFilter | undefined, columns = '*') =>
    status === undefined
      ? (client.from(`${view}_by_level`).select(columns) as unknown as FilterBuilder)
      : (client.from(`${view}_by_status`).select(columns) as unknown as FilterBuilder);
  const statusGroup = (builder: FilterBuilder, status: StatusFilter | undefined) =>
    status === undefined ? builder : builder.eq('status_group', status);

  return {
    async findMany(query: InvestmentQuery) {
      const rows = unwrap((await applyQuery(table('investments'), query)) as Result<InvestmentRow[]>);
      return (rows ?? []).map(mapInvestmentRow);
    },
    async findByCui(cui) {
      const row = unwrap(await table('investments').eq('cui', cui).maybeSingle<InvestmentRow>());
      return row ? mapInvestmentRow(row) : null;
    },
    async functionSummaries(departmentCode, level = 'ALL', status) {
      // The views have one row per level plus an 'ALL' row (and per status group), so both are always filtered.
      const source =
        departmentCode === undefined
          ? statusGroup(byStatus('function_summary', status).eq('government_level', level), status)
          : statusGroup(byStatus('department_function_summary', status).eq('government_level', level), status).eq(
              'department_code',
              departmentCode,
            );
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
    async getRecentCostIncreases({ departmentCode, level, status, limit }) {
      // `!inner` turns the embedded investment into a join, so its filters drop other departments, levels and statuses.
      const increases = costChanges(`${COST_CHANGE_COLUMNS},investments!inner(name,department_code,government_level,status)`)
        .eq('change_kind', 'changed')
        .gt('updated_cost_delta', 0);
      const scoped = withStatus(
        atLevel(
          departmentCode === undefined ? increases : increases.eq('investments.department_code', departmentCode),
          'investments.government_level',
          level,
        ),
        'investments.status',
        status,
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
      // The rule needs status ACTIVO: closed projects are never stalled.
      if (params.status === 'CLOSED') return [];
      const rows = unwrap(
        (await applyQuery(stalled(STALLED_INVESTMENT_COLUMNS), buildStalledQuery(params))) as Result<
          StalledInvestmentRow[]
        >,
      );
      return (rows ?? []).map(mapStalledInvestmentRow);
    },
    async countStalledInvestments(departmentCode, level, status) {
      if (status === 'CLOSED') return 0;
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
    async getRegionComparison(level = 'ALL', status) {
      const rows = unwrap(
        (await statusGroup(byStatus('region_comparison', status, REGION_COMPARISON_COLUMNS).eq('government_level', level), status)
          .order('department_code', { ascending: true })) as Result<RegionComparisonRow[]>,
      );
      return (rows ?? []).map(mapRegionComparisonRow);
    },
    async getEntityComparison(params) {
      const view = params.status === undefined ? 'entity_comparison' : 'entity_comparison_by_status';
      const source = client.from(view).select(ENTITY_COMPARISON_COLUMNS) as unknown as FilterBuilder;
      const rows = unwrap((await applyQuery(source, buildEntityQuery(params))) as Result<EntityComparisonRow[]>);
      return (rows ?? []).map(mapEntityComparisonRow);
    },
    async getMapPoints({ bbox, zoom, level, departmentCode, filters, status }) {
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
        ...statusArgument(status),
      })) as Result<MapPointRow[]>;
      return mapMapPointRows(unwrap(result) ?? []);
    },
    async getMapList({ bbox, level, departmentCode, filters = [], status, page, pageSize = MAP_LIST_PAGE_SIZE }) {
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
        ...statusArgument(status),
      })) as Result<MapListRow[]>;
      return mapMapListRows(unwrap(result) ?? []);
    },
    async getParalyzedDetail(cui) {
      const summary = unwrap(
        await (client.from('paralyzed_by_cui').select(PARALYZED_SUMMARY_COLUMNS) as unknown as FilterBuilder)
          .eq('cui', cui)
          .maybeSingle<ParalyzedSummaryRow>(),
      );
      if (!summary) return null;
      const works = unwrap(
        (await (client.from('latest_paralyzed_works').select(PARALYZED_WORK_COLUMNS) as unknown as FilterBuilder)
          .eq('cui', cui)
          .order('remaining_work_balance', { ascending: false, nullsFirst: false })
          .order('infobras_code', { ascending: true, nullsFirst: false })) as Result<ParalyzedWorkRow[]>,
      );
      return { summary: mapParalyzedSummaryRow(summary), works: (works ?? []).map(mapParalyzedWorkRow) };
    },
    async getParalyzedInvestments(params) {
      const source = client.from('paralyzed_investments').select(PARALYZED_INVESTMENT_COLUMNS) as unknown as FilterBuilder;
      const rows = unwrap((await applyQuery(source, buildParalyzedQuery(params))) as Result<ParalyzedInvestmentRow[]>);
      return (rows ?? []).map(mapParalyzedInvestmentRow);
    },
    async countParalyzedInvestments(departmentCode, level, status) {
      const head = client.from('paralyzed_investments').select('cui', { count: 'exact', head: true }) as unknown as FilterBuilder;
      const { filters } = buildParalyzedQuery({ departmentCode, level, status, page: 0 });
      const result = (await filters.reduce(applyFilter, head)) as Result<unknown>;
      unwrap(result);
      return result.count ?? 0;
    },
    async getParalyzedEdition() {
      const row = unwrap(
        await (client.from('latest_paralyzed_works').select('edition_cutoff,published_at') as unknown as FilterBuilder)
          .limit(1)
          .maybeSingle<{ edition_cutoff: string | null; published_at: string | null }>(),
      );
      return row?.edition_cutoff ? { editionCutoff: row.edition_cutoff, publishedAt: row.published_at ?? null } : null;
    },
    async getInfobrasWorks(cui) {
      const rows = unwrap(
        (await (client.from('infobras_works').select(INFOBRAS_WORK_COLUMNS) as unknown as FilterBuilder)
          .eq('cui', cui)
          // Invalid contract amounts (Regla de Fiscus) last: their figure is not shown.
          .order('contract_amount_valid', { ascending: false })
          .order('contract_amount', { ascending: false, nullsFirst: false })
          .order('infobras_code', { ascending: true, nullsFirst: false })
          .limit(INFOBRAS_WORKS_LIMIT)) as Result<InfobrasWorkRow[]>,
      );
      return (rows ?? []).map(mapInfobrasWorkRow);
    },
    async getInfobrasDataAsOf() {
      const row = unwrap(
        await (client.from('data_freshness').select('data_as_of') as unknown as FilterBuilder)
          .eq('source', INFOBRAS_FRESHNESS_SOURCE)
          .maybeSingle<{ data_as_of: string | null }>(),
      );
      return row?.data_as_of ?? null;
    },
    async getContractorRanking({ sort, departmentCode, level = 'ALL', status = 'ALL', page, pageSize = PAGE_SIZE }) {
      const result = (await client.rpc('contractor_ranking', {
        level,
        department: departmentCode ?? null,
        status_filter: status,
        sort_by: sort,
        page_limit: pageSize,
        page_offset: page * pageSize,
      })) as Result<ContractorRankingRow[]>;
      return mapContractorRankingRows(unwrap(result) ?? []);
    },
    async getContractorSummary(ruc) {
      const row = unwrap(
        await (client.from('contractor_summary').select(CONTRACTOR_SUMMARY_COLUMNS) as unknown as FilterBuilder)
          .eq('contractor_ruc', ruc)
          .maybeSingle<ContractorSummaryRow>(),
      );
      return row ? mapContractorSummaryRow(row) : null;
    },
    async getContractorWorks({ ruc, page, pageSize = PAGE_SIZE }) {
      const rows = unwrap(
        (await (client.from('contractor_works').select(CONTRACTOR_WORK_COLUMNS) as unknown as FilterBuilder)
          .eq('contractor_ruc', ruc)
          .order('contract_amount_valid', { ascending: false })
          .order('contract_amount', { ascending: false, nullsFirst: false })
          .order('infobras_code', { ascending: true, nullsFirst: false })
          .range(page * pageSize, (page + 1) * pageSize - 1)) as Result<ContractorWorkRow[]>,
      );
      return (rows ?? []).map(mapContractorWorkRow);
    },
  };
}
