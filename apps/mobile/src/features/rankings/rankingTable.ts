import { regionLabel } from '@/features/department/departments';
import type { TermId } from '@/features/glossary/terms';
import { levelTag, projectTag } from '@/features/government-level/levelPresentation';
import { contractorKindLabel, identifierText, invalidContractsText } from '@/features/infobras/infobrasPresentation';
import type { EntityComparison } from '@/features/investments/domain/entityComparison';
import type { ContractorRankingItem, ContractorSort } from '@/features/investments/domain/infobras';
import type { Investment, RankingKind } from '@/features/investments/domain/investment';
import type { ParalyzedInvestment } from '@/features/investments/domain/paralyzed';
import type { StalledInvestment } from '@/features/investments/domain/stalled';
import { paralyzedCausal, paralyzedProgressText } from '@/features/paralyzed/paralyzedPresentation';
import {
  formatInteger,
  formatMonthShort,
  formatProgress,
  formatSignedPercent,
  formatSignedSoles,
  formatSoles,
  formatYears,
  yearsSince,
} from '@/shared/format';
import type { TableColumn, TableRowData } from '@/shared/ui/DataTable';

import type { EntitySort } from './entityPresentation';
import type { RankingList } from './rankingPresentation';

export type TableTarget =
  | { kind: 'investment'; cui: string }
  | { kind: 'entity'; index: number }
  | { kind: 'contractor'; ruc: string };

export interface TableRow extends TableRowData {
  target: TableTarget;
}

export interface RankingTable {
  columns: TableColumn[];
  rows: TableRow[];
}

interface Options {
  /** Ranking all of Peru: the region is announced (and shown as a column). */
  national?: boolean;
  /** Tablet: only the essential figures. */
  compact?: boolean;
  entitySort?: EntitySort;
  contractorSort?: ContractorSort;
}

/** A column definition: whether the compact table keeps it, and its value for one item. */
interface ColumnSpec<T> {
  key: string;
  label: string;
  /** Glossary term explained by a hint in the desktop header. */
  term?: TermId;
  /** A short text (left-aligned, wider) instead of a figure. */
  text?: boolean;
  compact: boolean;
  value: (item: T) => string;
}

function build<T>(
  specs: ColumnSpec<T>[],
  sortedKey: string,
  items: readonly T[],
  row: (item: T, index: number) => Omit<TableRow, 'cells' | 'summary'>,
  options: Options,
): RankingTable {
  const kept = options.compact ? specs.filter((spec) => spec.compact || spec.key === sortedKey) : specs;
  const columns = kept.map((spec) => ({
    key: spec.key,
    label: spec.label,
    sorted: spec.key === sortedKey,
    ...(spec.term ? { term: spec.term } : {}),
    ...(spec.text ? { text: true } : {}),
  }));
  const rows = items.map((item, index) => {
    const base = row(item, index);
    const cells = kept.map((spec) => spec.value(item));
    const figures = kept.map((spec, i) => `${spec.label} ${cells[i]}`);
    const summary = (options.national ? [base.region, ...figures] : figures).join(', ');
    return { ...base, cells, summary };
  });
  return { columns, rows };
}

const APPROVED: ColumnSpec<Investment> = {
  key: 'approved',
  label: 'Aprobado',
  term: 'monto-viable',
  compact: false,
  value: (item) => formatSoles(item.viableAmount),
};
const CURRENT: ColumnSpec<Investment> = {
  key: 'current',
  label: 'Costo actual',
  term: 'costo-actualizado',
  compact: true,
  value: (item) => formatSoles(item.updatedCost),
};
const INCREASE: ColumnSpec<Investment> = {
  key: 'increase',
  label: 'Aumento S/',
  term: 'aumento',
  compact: true,
  value: (item) => formatSignedSoles(item.costIncrease),
};
const PCT: ColumnSpec<Investment> = {
  key: 'pct',
  label: '%',
  compact: true,
  value: (item) => formatSignedPercent(item.costIncreasePct),
};
const SPENT: ColumnSpec<Investment> = {
  key: 'spent',
  label: 'Gastado',
  term: 'gastado',
  compact: false,
  value: (item) => formatProgress(item.executionProgress),
};

function projectSpecs(kind: RankingKind, now: Date): { specs: ColumnSpec<Investment>[]; sorted: string } {
  switch (kind) {
    case 'increase-amount':
      return { specs: [APPROVED, CURRENT, INCREASE, PCT], sorted: 'increase' };
    case 'increase-pct':
      return { specs: [APPROVED, CURRENT, INCREASE, PCT], sorted: 'pct' };
    case 'cost':
      return { specs: [APPROVED, CURRENT, SPENT, INCREASE, PCT], sorted: 'current' };
    case 'duration': {
      const running: ColumnSpec<Investment> = {
        key: 'running',
        label: 'En curso',
        compact: true,
        value: (item) => formatYears(yearsSince(item.viabilityAt, now)),
      };
      // The time running replaces the percentage in the compact table.
      return { specs: [APPROVED, CURRENT, INCREASE, { ...PCT, compact: false }, running], sorted: 'running' };
    }
  }
}

const STALLED_SPECS: ColumnSpec<StalledInvestment>[] = [
  { key: 'since', label: 'Sin gasto desde', term: 'sin-gasto-reciente', compact: true, value: (item) => formatMonthShort(item.lastAccrualMonth) },
  { key: 'spent', label: 'Gastado', term: 'gastado', compact: true, value: (item) => formatProgress(item.executionProgress) },
  { key: 'pending', label: 'Por ejecutar', compact: true, value: (item) => formatSoles(item.pendingAmount) },
  { key: 'current', label: 'Costo actual', term: 'costo-actualizado', compact: false, value: (item) => formatSoles(item.updatedCost) },
];

const PARALYZED_SPECS: ColumnSpec<ParalyzedInvestment>[] = [
  { key: 'causal', label: 'Causal', term: 'obra-paralizada', text: true, compact: true, value: (item) => paralyzedCausal(item.mainCausalLabel) },
  { key: 'progress', label: 'Avance físico', term: 'avance-fisico', compact: true, value: paralyzedProgressText },
  { key: 'balance', label: 'Saldo de obra', compact: true, value: (item) => formatSoles(item.totalRemainingWorkBalance) },
  { key: 'obras', label: 'Obras', compact: false, value: (item) => formatInteger(item.obraCount) },
];

const ENTITY_SPECS: ColumnSpec<EntityComparison>[] = [
  { key: 'projects', label: 'Proyectos', compact: true, value: (item) => formatInteger(item.projectCount) },
  { key: 'with-increase', label: 'Con aumento', compact: false, value: (item) => formatInteger(item.projectsWithIncrease) },
  { key: 'increase-amount', label: 'Aumento S/', term: 'aumento', compact: true, value: (item) => formatSignedSoles(item.totalCostIncrease) },
  { key: 'increase-pct', label: '%', compact: false, value: (item) => formatSignedPercent(item.costIncreasePct) },
  { key: 'stalled', label: 'Sin gasto', term: 'sin-gasto-reciente', compact: false, value: (item) => formatInteger(item.stalledCount) },
  { key: 'overspent', label: 'Gasto sobre costo', compact: false, value: (item) => formatInteger(item.overspentCount) },
];

const CONTRACTOR_SPECS: ColumnSpec<ContractorRankingItem>[] = [
  { key: 'obras', label: 'Obras', compact: true, value: (item) => formatInteger(item.obraCount) },
  { key: 'contract', label: 'Monto contratado', compact: true, value: (item) => formatSoles(item.totalContractAmount) },
  {
    key: 'additional',
    label: 'Adicionales',
    term: 'adicional-de-obra',
    compact: false,
    value: (item) => formatSoles(item.totalAdditionalWorks),
  },
  {
    key: 'paralyzed',
    label: 'Paralizadas (Contraloría)',
    term: 'obra-paralizada',
    compact: false,
    value: (item) => formatInteger(item.contraloriaParalyzedCount),
  },
];

const projectRow = (item: Investment): Omit<TableRow, 'cells' | 'summary'> => ({
  key: item.cui,
  name: item.name ?? 'Sin nombre',
  sub: item.entity,
  tag: projectTag(item),
  region: regionLabel(item.departmentCode),
  target: { kind: 'investment', cui: item.cui },
});

/** The columns and rows of the selected ranking tab as a table (tablet and desktop). */
export function rankingTable(list: RankingList, now: Date, options: Options = {}): RankingTable {
  switch (list.kind) {
    case 'entities':
      return build(
        ENTITY_SPECS,
        options.entitySort ?? 'increase-amount',
        list.items,
        (item, index) => ({
          key: `${item.governmentLevel ?? ''}:${item.entity}`,
          name: item.entity,
          sub: null,
          tag: levelTag(item.governmentLevel),
          region: regionLabel(item.departmentCode),
          target: { kind: 'entity', index },
        }),
        options,
      );
    case 'stalled':
      return build(STALLED_SPECS, 'since', list.items, projectRow, options);
    case 'contractors':
      // Contractors have no level or region: the table is laid out without them (national: false).
      return build(
        CONTRACTOR_SPECS,
        options.contractorSort ?? 'contract',
        list.items,
        (item) => ({
          key: item.ruc,
          name: item.name ?? item.ruc,
          sub: [contractorKindLabel(item.kind), identifierText(item.ruc), invalidContractsText(item.invalidContractCount)]
            .filter(Boolean)
            .join(' · '),
          region: '',
          target: { kind: 'contractor', ruc: item.ruc },
        }),
        { ...options, national: false },
      );
    case 'paralyzed':
      return build(
        PARALYZED_SPECS,
        'balance',
        list.items,
        (item) => ({
          key: item.cui,
          name: item.name ?? 'Sin nombre',
          sub: item.entity,
          tag: projectTag(item),
          region: regionLabel(item.departmentCode),
          target: { kind: 'investment', cui: item.cui },
        }),
        options,
      );
    default: {
      const { specs, sorted } = projectSpecs(list.kind, now);
      return build(specs, sorted, list.items, projectRow, options);
    }
  }
}
