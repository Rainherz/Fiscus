import { formatInteger, formatSignedPercent, formatSignedSoles, formatSolesCompact } from '@/shared/format';

import { DEPARTMENTS, departmentName, type Department } from '../department/departments';
import { REGION_SORTS, type RegionComparison, type RegionSort } from '../investments/domain/regionComparison';
import { STALLED_RULE_NOTE } from '../stalled/stalledPresentation';

/** Without the final period: the empty state adds the level and status that are on. */
export const REGIONS_EMPTY = 'No hay datos de regiones';

export const REGION_SORT_OPTIONS: readonly { key: RegionSort; label: string }[] = [
  { key: 'increase-amount', label: 'Mayor aumento (S/)' },
  { key: 'increase-pct', label: 'Mayor aumento (%)' },
  { key: 'stalled', label: 'Más obras sin gasto reciente' },
  { key: 'overspent', label: 'Más gasto sobre el costo' },
];

/** Every department by name, for the picker while the comparison is loading or failed. */
export const ALPHABETICAL_DEPARTMENTS: readonly Department[] = [...DEPARTMENTS].sort((a, b) =>
  a.name.localeCompare(b.name, 'es'),
);

/** Departments the comparison has no row for, so the picker can still offer them. */
export function departmentsWithoutData(regions: readonly RegionComparison[]): Department[] {
  const present = new Set(regions.map((region) => region.departmentCode));
  return ALPHABETICAL_DEPARTMENTS.filter((department) => !present.has(department.code));
}

export function isRegionSort(value: unknown): value is RegionSort {
  return typeof value === 'string' && (REGION_SORTS as readonly string[]).includes(value);
}

/** The accented name of the region selector, not the uppercase MEF label. */
export function regionName(region: RegionComparison): string {
  return departmentName(region.departmentCode);
}

const projects = (count: number) => `${formatInteger(count)} ${count === 1 ? 'proyecto' : 'proyectos'}`;

/** The figure a region is ranked by. */
export function regionValue(sort: RegionSort, region: RegionComparison): string {
  switch (sort) {
    case 'increase-amount':
      return formatSignedSoles(region.totalCostIncrease);
    case 'increase-pct':
      return formatSignedPercent(region.costIncreasePct);
    case 'stalled':
      return formatInteger(region.stalledCount);
    case 'overspent':
      return formatInteger(region.overspentCount);
  }
}

/** A second factual line with the context the main figure leaves out. */
export function regionDetail(sort: RegionSort, region: RegionComparison): string {
  const increased = `${formatInteger(region.projectsWithIncrease)} con aumento`;
  switch (sort) {
    case 'increase-amount':
      return `${projects(region.projectCount)} · ${increased}`;
    case 'increase-pct':
      return `${increased} · ${formatSignedSoles(region.totalCostIncrease)}`;
    case 'stalled':
      return `${projects(region.projectCount)} · ${formatSolesCompact(region.stalledPendingAmount)} por ejecutar`;
    case 'overspent':
      return `${projects(region.projectCount)} · ${formatInteger(region.stalledCount)} sin gasto reciente`;
  }
}

/** The main figure with its unit, for screen readers (counts alone are ambiguous). */
export function regionSummary(sort: RegionSort, region: RegionComparison): string {
  const value = regionValue(sort, region);
  switch (sort) {
    case 'stalled':
      return `${value} sin gasto reciente`;
    case 'overspent':
      return `${value} con gasto sobre el costo`;
    default:
      return value;
  }
}

export function regionNote(sort: RegionSort): string {
  switch (sort) {
    case 'increase-amount':
      return 'Suma de los aumentos de costo. No descuenta las reducciones.';
    case 'increase-pct':
      return 'Aumentos sumados sobre el monto viable de los proyectos que aumentaron.';
    case 'stalled':
      return STALLED_RULE_NOTE;
    case 'overspent':
      return 'Proyectos cuyo gasto acumulado supera su costo actualizado.';
  }
}
