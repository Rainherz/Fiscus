import { isCostIncrease, type CostChange } from '../domain/costChange';
import { computeEntityComparison, type EntityComparison } from '../domain/entityComparison';
import type { LevelFilter } from '../domain/governmentLevel';
import type { DataFreshness } from '../domain/freshness';
import type { FunctionSummary, IngestRun } from '../domain/investment';
import { computeMapList, computeMapPoints } from '../domain/mapPoints';
import {
  mapCostChangeRow,
  mapInvestmentRow,
  mapStalledInvestmentRow,
  mapEntityComparisonRow,
  type CostChangeRow,
  type EntityComparisonRow,
  type InvestmentRow,
  type StalledInvestmentRow,
} from '../domain/mappers';
import {
  NATIONAL_SCOPE_CODE,
  buildEntityQuery,
  buildStalledQuery,
  type Filter,
  type InvestmentQuery,
  type Order,
} from '../domain/queries';
import { computeRegionComparison } from '../domain/regionComparison';
import { toStalledInvestment } from '../domain/stalled';
import type { InvestmentsRepository } from '../ports/InvestmentsRepository';

type Value = string | number | boolean | null;

type Row = object;

function read(row: Row, column: string): Value {
  const value = (row as unknown as Record<string, Value | undefined>)[column];
  if (value === undefined || value === '') return null;
  if (typeof value === 'string' && column !== 'cui' && /^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return value;
}

/** SQL LIKE pattern (with backslash escapes) to a case-insensitive RegExp. */
function likeToRegExp(pattern: string): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '\\' && i + 1 < pattern.length) {
      source += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else if (char === '%') source += '.*';
    else if (char === '_') source += '.';
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`, 'i');
}

function matches(row: Row, filter: Filter<string>): boolean {
  const value = read(row, filter.column);
  switch (filter.op) {
    case 'eq':
      return value !== null && value === filter.value;
    case 'gt':
      return typeof value === typeof filter.value && (value as string | number) > filter.value;
    case 'gte':
      return typeof value === typeof filter.value && (value as string | number) >= filter.value;
    case 'ilike':
      return typeof value === 'string' && likeToRegExp(filter.value).test(value);
    case 'notNull':
      return value !== null;
    case 'isNull':
      return value === null;
  }
}

function compare(a: Row, b: Row, orders: Order<string>[]): number {
  for (const { column, ascending } of orders) {
    const x = read(a, column);
    const y = read(b, column);
    if (x === y) continue;
    if (x === null) return 1; // nulls last
    if (y === null) return -1;
    const result = (x as string | number) < (y as string | number) ? -1 : 1;
    return ascending ? result : -result;
  }
  return 0;
}

/** Rows matching a query spec, sorted and sliced to its range. */
function runQuery<R extends Row>(rows: R[], query: InvestmentQuery<string>): R[] {
  return rows
    .filter((row) => query.filters.every((filter) => matches(row, filter)))
    .sort((a, b) => compare(a, b, query.order))
    .slice(query.range.from, query.range.to + 1);
}

/** Latest last_accrual_month of all rows, like the `accrual_reference_month_all_levels` view. */
function referenceMonth(rows: InvestmentRow[]): string | null {
  return rows.reduce<string | null>((latest, row) => {
    const month = row.last_accrual_month ?? null;
    return month !== null && (latest === null || month > latest) ? month : latest;
  }, null);
}

/** Rows of the `stalled_investments_by_level` view, derived with the domain rule. */
function stalledRows(rows: InvestmentRow[]): StalledInvestmentRow[] {
  const reference = referenceMonth(rows);
  return rows.flatMap((row) => {
    const stalled = toStalledInvestment(mapInvestmentRow(row), reference);
    return stalled
      ? [{ ...row, months_without_accrual: stalled.monthsWithoutAccrual, pending_amount: stalled.pendingAmount }]
      : [];
  });
}

const sumOrNull = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};

const atLevel = (level: LevelFilter | undefined) => (row: InvestmentRow) =>
  level === undefined || level === 'ALL' || row.government_level === level;

/** A computed entity as a row of the `entity_comparison` view, so its query spec applies as-is. */
function toEntityRow(entity: EntityComparison, scope: number): EntityComparisonRow {
  return {
    entity: entity.entity,
    government_level: entity.governmentLevel,
    scope_department_code: scope,
    department_code: entity.departmentCode,
    department_name: entity.departmentName,
    project_count: entity.projectCount,
    valid_cost_count: entity.validCostCount,
    total_updated_cost: entity.totalUpdatedCost,
    total_cost_increase: entity.totalCostIncrease,
    projects_with_increase: entity.projectsWithIncrease,
    increased_viable_amount: entity.increasedViableAmount,
    cost_increase_pct: entity.costIncreasePct,
    overspent_count: entity.overspentCount,
    stalled_count: entity.stalledCount,
    stalled_pending_amount: entity.stalledPendingAmount,
  };
}

/** Chronological order by observation time, then insertion order (id), like the database. */
const byObservation = (a: CostChange, b: CostChange) =>
  Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.id - b.id;

/** Repository over an array of rows. Backs the demo mode (EXPO_PUBLIC_USE_MOCK=1) and tests. */
export function createInMemoryInvestmentsRepository(seed: {
  rows: InvestmentRow[];
  lastRun: IngestRun | null;
  costChanges?: CostChangeRow[];
  /** Defaults to the last run as the last SSI success and no open-data check. */
  freshness?: DataFreshness;
}): InvestmentsRepository {
  const rows = seed.rows;
  const changes = (seed.costChanges ?? []).map(mapCostChangeRow);
  return {
    async findMany(query: InvestmentQuery) {
      return runQuery(rows, query).map(mapInvestmentRow);
    },
    async findByCui(cui) {
      const row = rows.find((r) => r.cui === cui);
      return row ? mapInvestmentRow(row) : null;
    },
    async functionSummaries(departmentCode, level) {
      const groups = new Map<string | null, InvestmentRow[]>();
      for (const row of rows.filter(atLevel(level))) {
        if (departmentCode !== undefined && row.department_code !== departmentCode) continue;
        const key = row.function ?? null;
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
      const summaries: FunctionSummary[] = [...groups].map(([fn, group]) => ({
        function: fn,
        investmentCount: group.length,
        totalUpdatedCost: sumOrNull(group.map((r) => read(r, 'updated_cost') as number | null)),
        totalCostIncrease: sumOrNull(group.map((r) => read(r, 'cost_increase') as number | null)),
      }));
      return summaries.sort((a, b) => {
        if (a.totalUpdatedCost === b.totalUpdatedCost) return 0;
        if (a.totalUpdatedCost === null) return 1;
        if (b.totalUpdatedCost === null) return -1;
        return b.totalUpdatedCost - a.totalUpdatedCost;
      });
    },
    async lastIngestRun() {
      return seed.lastRun;
    },
    async getDataFreshness() {
      return seed.freshness ?? { ssiLastSuccessAt: seed.lastRun?.finishedAt ?? null, openDataCheckedAt: null };
    },
    async getCostHistory(cui) {
      return changes.filter((change) => change.cui === cui).sort(byObservation);
    },
    async getRecentCostIncreases({ departmentCode, level, limit }) {
      const investments = new Map(rows.filter(atLevel(level)).map((row) => [row.cui, row]));
      return changes
        .filter(isCostIncrease)
        .flatMap((change) => {
          const investment = investments.get(change.cui);
          if (!investment) return [];
          if (departmentCode !== undefined && investment.department_code !== departmentCode) return [];
          return [
            {
              ...change,
              name: investment.name ?? null,
              departmentCode: investment.department_code,
              governmentLevel: mapInvestmentRow(investment).governmentLevel,
            },
          ];
        })
        .sort((a, b) => byObservation(b, a))
        .slice(0, limit);
    },
    async getStalledInvestments(params) {
      return runQuery(stalledRows(rows), buildStalledQuery(params)).map(mapStalledInvestmentRow);
    },
    async countStalledInvestments(departmentCode, level) {
      return stalledRows(rows)
        .filter(atLevel(level))
        .filter((row) => departmentCode === undefined || row.department_code === departmentCode).length;
    },
    async getAccrualReferenceMonth() {
      return referenceMonth(rows);
    },
    async getRegionComparison(level) {
      // Like region_comparison_by_level: only the 25 departments.
      const inDepartment = (row: InvestmentRow) => row.department_code !== null && atLevel(level)(row);
      return computeRegionComparison(
        rows.filter(inDepartment).map(mapInvestmentRow),
        stalledRows(rows).filter(inDepartment).map(mapStalledInvestmentRow),
      );
    },
    async getEntityComparison(params) {
      const entities = computeEntityComparison(
        rows.map(mapInvestmentRow),
        stalledRows(rows).map(mapStalledInvestmentRow),
        params.departmentCode,
      );
      const scope = params.departmentCode ?? NATIONAL_SCOPE_CODE;
      return runQuery(
        entities.map((entity) => toEntityRow(entity, scope)),
        buildEntityQuery(params),
      ).map(mapEntityComparisonRow);
    },
    async getMapPoints(request) {
      return computeMapPoints(rows.map(mapInvestmentRow), request);
    },
    async getMapList(request) {
      return computeMapList(rows.map(mapInvestmentRow), request);
    },
  };
}
