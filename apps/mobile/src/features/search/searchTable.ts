import { regionLabel } from '@/features/department/departments';
import { levelTag } from '@/features/government-level/levelPresentation';
import type { Investment } from '@/features/investments/domain/investment';
import { formatSignedPercent, formatSignedSoles, formatSoles } from '@/shared/format';
import type { TableColumn, TableRowData } from '@/shared/ui/DataTable';

interface Spec {
  key: string;
  label: string;
  compact: boolean;
  value: (item: Investment) => string;
}

const SPECS: Spec[] = [
  { key: 'cui', label: 'CUI', compact: true, value: (item) => item.cui },
  { key: 'current', label: 'Costo actual', compact: true, value: (item) => formatSoles(item.updatedCost) },
  { key: 'increase', label: 'Aumento S/', compact: true, value: (item) => formatSignedSoles(item.costIncrease) },
  { key: 'pct', label: '%', compact: false, value: (item) => formatSignedPercent(item.costIncreasePct) },
];

/** Search results as a table (tablet and desktop). Results are not ranked by a figure. */
export function searchTable(
  results: readonly Investment[],
  options: { national?: boolean; compact?: boolean } = {},
): { columns: TableColumn[]; rows: (TableRowData & { cui: string })[] } {
  const specs = options.compact ? SPECS.filter((spec) => spec.compact) : SPECS;
  return {
    columns: specs.map((spec) => ({ key: spec.key, label: spec.label, sorted: false })),
    rows: results.map((item) => {
      const cells = specs.map((spec) => spec.value(item));
      const region = regionLabel(item.departmentCode);
      const figures = specs.map((spec, index) => `${spec.label} ${cells[index]}`);
      return {
        key: item.cui,
        cui: item.cui,
        name: item.name ?? 'Sin nombre',
        sub: item.entity,
        tag: levelTag(item.governmentLevel),
        region,
        cells,
        summary: (options.national ? [region, ...figures] : figures).join(', '),
      };
    }),
  };
}
