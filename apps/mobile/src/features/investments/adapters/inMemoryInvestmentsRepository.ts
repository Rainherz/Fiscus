import { isCostIncrease, type CostChange } from '../domain/costChange';
import type { FunctionSummary, IngestRun } from '../domain/investment';
import {
  mapCostChangeRow,
  mapInvestmentRow,
  type CostChangeRow,
  type InvestmentRow,
} from '../domain/mappers';
import type { Filter, InvestmentColumn, InvestmentQuery, Order } from '../domain/queries';
import type { InvestmentsRepository } from '../ports/InvestmentsRepository';

type Value = string | number | boolean | null;

function read(row: InvestmentRow, column: InvestmentColumn): Value {
  const value = row[column];
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

function matches(row: InvestmentRow, filter: Filter): boolean {
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

function compare(a: InvestmentRow, b: InvestmentRow, orders: Order[]): number {
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

const sumOrNull = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};

/** Chronological order by observation time, then insertion order (id), like the database. */
const byObservation = (a: CostChange, b: CostChange) =>
  Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.id - b.id;

/** Repository over an array of rows. Backs the demo mode (EXPO_PUBLIC_USE_MOCK=1) and tests. */
export function createInMemoryInvestmentsRepository(seed: {
  rows: InvestmentRow[];
  lastRun: IngestRun | null;
  costChanges?: CostChangeRow[];
}): InvestmentsRepository {
  const rows = seed.rows;
  const changes = (seed.costChanges ?? []).map(mapCostChangeRow);
  return {
    async findMany(query: InvestmentQuery) {
      return rows
        .filter((row) => query.filters.every((filter) => matches(row, filter)))
        .sort((a, b) => compare(a, b, query.order))
        .slice(query.range.from, query.range.to + 1)
        .map(mapInvestmentRow);
    },
    async findByCui(cui) {
      const row = rows.find((r) => r.cui === cui);
      return row ? mapInvestmentRow(row) : null;
    },
    async functionSummaries(departmentCode) {
      const groups = new Map<string | null, InvestmentRow[]>();
      for (const row of rows) {
        if (row.department_code !== departmentCode) continue;
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
    async getCostHistory(cui) {
      return changes.filter((change) => change.cui === cui).sort(byObservation);
    },
    async getRecentCostIncreases({ departmentCode, limit }) {
      const investments = new Map(rows.map((row) => [row.cui, row]));
      return changes
        .filter(isCostIncrease)
        .flatMap((change) => {
          const investment = investments.get(change.cui);
          if (investment?.department_code !== departmentCode) return [];
          return [{ ...change, name: investment.name ?? null }];
        })
        .sort((a, b) => byObservation(b, a))
        .slice(0, limit);
    },
  };
}
