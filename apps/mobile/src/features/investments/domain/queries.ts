import type { LevelFilter } from './governmentLevel';
import type { RankingKind } from './investment';
import type { RegionSort } from './regionComparison';

/**
 * Backend-agnostic query specs over the `investments` table. Adapters translate them
 * (Supabase/PostgREST, in-memory), so the ranking rules live in one tested place.
 */

export type InvestmentColumn =
  | 'cui'
  | 'name'
  | 'status'
  | 'function_canonical'
  | 'department_code'
  | 'government_level'
  | 'entity'
  | 'viable_amount'
  | 'updated_cost'
  | 'updated_cost_valid'
  | 'cost_increase'
  | 'cost_increase_pct'
  | 'viability_at';

/** Columns of the `entity_comparison` view used by its query spec. */
export type EntityColumn =
  | 'entity'
  | 'government_level'
  | 'scope_department_code'
  | 'total_cost_increase'
  | 'increased_viable_amount'
  | 'cost_increase_pct'
  | 'overspent_count'
  | 'stalled_count'
  | 'stalled_pending_amount';

/** Columns of the `stalled_investments` view: the investment columns plus two derived ones. */
export type StalledColumn = InvestmentColumn | 'pending_amount' | 'months_without_accrual';

export type Filter<C extends string = InvestmentColumn> =
  | { column: C; op: 'eq'; value: string | number | boolean }
  | { column: C; op: 'gt' | 'gte'; value: string | number }
  | { column: C; op: 'ilike'; value: string }
  | { column: C; op: 'notNull' | 'isNull' };

export interface Order<C extends string = InvestmentColumn> {
  column: C;
  ascending: boolean;
}

export interface InvestmentQuery<C extends string = InvestmentColumn> {
  filters: Filter<C>[];
  /** Applied in sequence; nulls always sort last. */
  order: Order<C>[];
  /** Inclusive row range. */
  range: { from: number; to: number };
}

export const PAGE_SIZE = 30;
/** Below this approved amount, percentage increases are dominated by tiny bases. */
export const PCT_RANKING_MIN_VIABLE_AMOUNT = 1_000_000;
const MIN_NAME_SEARCH_LENGTH = 3;

const tieBreak: Order = { column: 'cui', ascending: true };

function pageRange(page: number, pageSize: number) {
  const from = page * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** The department filter, or none for all of Peru (`departmentCode` undefined). */
function inScope<C extends string = InvestmentColumn>(departmentCode: number | undefined): Filter<C>[] {
  return departmentCode === undefined
    ? []
    : [{ column: 'department_code' as C, op: 'eq', value: departmentCode }];
}

/** One government level, or none for every level. */
function atLevel<C extends string = InvestmentColumn>(level: LevelFilter | undefined): Filter<C>[] {
  return level === undefined || level === 'ALL'
    ? []
    : [{ column: 'government_level' as C, op: 'eq', value: level }];
}

function ofEntity<C extends string = InvestmentColumn>(entity: string | undefined): Filter<C>[] {
  return entity === undefined ? [] : [{ column: 'entity' as C, op: 'eq', value: entity }];
}

/** Department, level and entity filters, in that order (they match the composite indexes). */
function inReadScope<C extends string = InvestmentColumn>(params: {
  departmentCode?: number;
  level?: LevelFilter;
  entity?: string;
}): Filter<C>[] {
  return [...inScope<C>(params.departmentCode), ...atLevel<C>(params.level), ...ofEntity<C>(params.entity)];
}

/** Placeholder costs in the source would distort cost-based rankings and the home hero. */
const validUpdatedCost: Filter = { column: 'updated_cost_valid', op: 'eq', value: true };

const RANKINGS: Record<RankingKind, { filters: Filter[]; order: Order }> = {
  'increase-amount': {
    filters: [validUpdatedCost, { column: 'cost_increase', op: 'gt', value: 0 }],
    order: { column: 'cost_increase', ascending: false },
  },
  'increase-pct': {
    filters: [
      validUpdatedCost,
      { column: 'viable_amount', op: 'gte', value: PCT_RANKING_MIN_VIABLE_AMOUNT },
      { column: 'cost_increase_pct', op: 'gt', value: 0 },
    ],
    order: { column: 'cost_increase_pct', ascending: false },
  },
  cost: {
    filters: [validUpdatedCost],
    order: { column: 'updated_cost', ascending: false },
  },
  duration: {
    filters: [
      { column: 'status', op: 'eq', value: 'ACTIVO' },
      { column: 'viability_at', op: 'notNull' },
    ],
    order: { column: 'viability_at', ascending: true },
  },
};

export function buildRankingQuery(params: {
  kind: RankingKind;
  /** Undefined ranks all of Peru. */
  departmentCode?: number;
  /** Undefined or 'ALL' ranks every level. */
  level?: LevelFilter;
  /** Only the projects of one entity (the entity drill-down). */
  entity?: string;
  page: number;
  pageSize?: number;
}): InvestmentQuery {
  const ranking = RANKINGS[params.kind];
  return {
    filters: [...inReadScope(params), ...ranking.filters],
    order: [ranking.order, tieBreak],
    range: pageRange(params.page, params.pageSize ?? PAGE_SIZE),
  };
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Digits are an exact CUI (unique nationwide, at every level); anything else searches names in the
 * department (or all of Peru when `departmentCode` is undefined) and the level.
 */
export function buildSearchQuery(
  text: string,
  departmentCode: number | undefined,
  level?: LevelFilter,
): InvestmentQuery | null {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (/^\d+$/.test(normalized)) {
    return {
      filters: [{ column: 'cui', op: 'eq', value: normalized }],
      order: [tieBreak],
      range: pageRange(0, PAGE_SIZE),
    };
  }
  if (normalized.length < MIN_NAME_SEARCH_LENGTH) return null;
  return {
    filters: [
      ...inReadScope({ departmentCode, level }),
      { column: 'name', op: 'ilike', value: `%${escapeLike(normalized)}%` },
    ],
    order: [{ column: 'updated_cost', ascending: false }, tieBreak],
    range: pageRange(0, PAGE_SIZE),
  };
}

export function buildFunctionQuery(params: {
  departmentCode?: number;
  level?: LevelFilter;
  fn: string | null;
  page: number;
}): InvestmentQuery {
  const byFunction: Filter =
    params.fn === null
      ? { column: 'function_canonical', op: 'isNull' }
      : { column: 'function_canonical', op: 'eq', value: params.fn };
  return {
    filters: [...inReadScope(params), byFunction],
    order: [{ column: 'updated_cost', ascending: false }, tieBreak],
    range: pageRange(params.page, PAGE_SIZE),
  };
}

/**
 * "Sin gasto reciente" in one department (or all of Peru), largest amount not yet spent first. The rule itself
 * lives in the `stalled_investments` view (and domain/stalled.ts for the in-memory adapter).
 */
export function buildStalledQuery(params: {
  departmentCode?: number;
  level?: LevelFilter;
  entity?: string;
  page: number;
  pageSize?: number;
}): InvestmentQuery<StalledColumn> {
  return {
    filters: inReadScope<StalledColumn>(params),
    order: [{ column: 'pending_amount', ascending: false }, tieBreak],
    range: pageRange(params.page, params.pageSize ?? PAGE_SIZE),
  };
}

const ENTITY_SORTS: Record<RegionSort, { filters: Filter<EntityColumn>[]; order: Order<EntityColumn>[] }> = {
  'increase-amount': {
    filters: [{ column: 'total_cost_increase', op: 'gt', value: 0 }],
    order: [{ column: 'total_cost_increase', ascending: false }],
  },
  'increase-pct': {
    filters: [
      { column: 'increased_viable_amount', op: 'gte', value: PCT_RANKING_MIN_VIABLE_AMOUNT },
      { column: 'cost_increase_pct', op: 'gt', value: 0 },
    ],
    order: [{ column: 'cost_increase_pct', ascending: false }],
  },
  stalled: {
    filters: [{ column: 'stalled_count', op: 'gt', value: 0 }],
    order: [
      { column: 'stalled_count', ascending: false },
      { column: 'stalled_pending_amount', ascending: false },
    ],
  },
  overspent: {
    filters: [{ column: 'overspent_count', op: 'gt', value: 0 }],
    order: [{ column: 'overspent_count', ascending: false }],
  },
};

/** `entity_comparison.scope_department_code` of all of Peru. */
export const NATIONAL_SCOPE_CODE = 0;

/**
 * "Entidades": entities ranked by one figure in the scope, only those with a figure above zero,
 * paged. In a department the view counts only the entity's projects there.
 */
export function buildEntityQuery(params: {
  sort: RegionSort;
  departmentCode?: number;
  level?: LevelFilter;
  page: number;
  pageSize?: number;
}): InvestmentQuery<EntityColumn> {
  const sort = ENTITY_SORTS[params.sort];
  return {
    filters: [
      { column: 'scope_department_code', op: 'eq', value: params.departmentCode ?? NATIONAL_SCOPE_CODE },
      ...atLevel<EntityColumn>(params.level),
      ...sort.filters,
    ],
    order: [
      ...sort.order,
      { column: 'entity', ascending: true },
      { column: 'government_level', ascending: true },
    ],
    range: pageRange(params.page, params.pageSize ?? PAGE_SIZE),
  };
}
