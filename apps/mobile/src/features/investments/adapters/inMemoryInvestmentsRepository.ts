import type { FunctionSummary, IngestRun } from '../domain/investment';
import { mapInvestmentRow, type InvestmentRow } from '../domain/mappers';
import type { Filter, InvestmentColumn, InvestmentQuery, Order } from '../domain/queries';
import type { InvestmentsRepository } from '../ports/InvestmentsRepository';

type Value = string | number | null;

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
      return value !== null && value > filter.value;
    case 'gte':
      return value !== null && value >= filter.value;
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
    const result = x < y ? -1 : 1;
    return ascending ? result : -result;
  }
  return 0;
}

const sumOrNull = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};

/** Repository over an array of rows. Backs the demo mode (EXPO_PUBLIC_USE_MOCK=1) and tests. */
export function createInMemoryInvestmentsRepository(seed: {
  rows: InvestmentRow[];
  lastRun: IngestRun | null;
}): InvestmentsRepository {
  const rows = seed.rows;
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
  };
}
