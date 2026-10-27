import type { RankingKind } from './investment';

/**
 * Backend-agnostic query specs over the `investments` table. Adapters translate them
 * (Supabase/PostgREST, in-memory), so the ranking rules live in one tested place.
 */

export type InvestmentColumn =
  | 'cui'
  | 'name'
  | 'status'
  | 'function'
  | 'department_code'
  | 'viable_amount'
  | 'updated_cost'
  | 'updated_cost_valid'
  | 'cost_increase'
  | 'cost_increase_pct'
  | 'viability_at';

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

function inDepartment(departmentCode: number): Filter {
  return { column: 'department_code', op: 'eq', value: departmentCode };
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
  departmentCode: number;
  page: number;
  pageSize?: number;
}): InvestmentQuery {
  const ranking = RANKINGS[params.kind];
  return {
    filters: [inDepartment(params.departmentCode), ...ranking.filters],
    order: [ranking.order, tieBreak],
    range: pageRange(params.page, params.pageSize ?? PAGE_SIZE),
  };
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Digits are an exact CUI (unique nationwide); anything else searches names in the department. */
export function buildSearchQuery(text: string, departmentCode: number): InvestmentQuery | null {
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
      inDepartment(departmentCode),
      { column: 'name', op: 'ilike', value: `%${escapeLike(normalized)}%` },
    ],
    order: [{ column: 'updated_cost', ascending: false }, tieBreak],
    range: pageRange(0, PAGE_SIZE),
  };
}

export function buildFunctionQuery(params: {
  departmentCode: number;
  fn: string | null;
  page: number;
}): InvestmentQuery {
  const byFunction: Filter =
    params.fn === null
      ? { column: 'function', op: 'isNull' }
      : { column: 'function', op: 'eq', value: params.fn };
  return {
    filters: [inDepartment(params.departmentCode), byFunction],
    order: [{ column: 'updated_cost', ascending: false }, tieBreak],
    range: pageRange(params.page, PAGE_SIZE),
  };
}

/**
 * "Sin gasto reciente" in one department, largest amount not yet spent first. The rule itself
 * lives in the `stalled_investments` view (and domain/stalled.ts for the in-memory adapter).
 */
export function buildStalledQuery(params: {
  departmentCode: number;
  page: number;
  pageSize?: number;
}): InvestmentQuery<StalledColumn> {
  return {
    filters: [{ column: 'department_code', op: 'eq', value: params.departmentCode }],
    order: [{ column: 'pending_amount', ascending: false }, tieBreak],
    range: pageRange(params.page, params.pageSize ?? PAGE_SIZE),
  };
}
