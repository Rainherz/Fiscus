import { formatInteger, formatSignedPercent, formatSignedSoles, formatSolesCompact } from '@/shared/format';

import { withRegion } from '../department/scope';
import type { EntityComparison } from '../investments/domain/entityComparison';
import { REGION_SORTS, type RegionSort } from '../investments/domain/regionComparison';
import { REGION_SORT_OPTIONS, regionNote } from '../regions/regionPresentation';

/** "Entidades" sorts like the region comparison. */
export type EntitySort = RegionSort;

export const ENTITY_SORT_OPTIONS = REGION_SORT_OPTIONS;

export function isEntitySort(value: unknown): value is EntitySort {
  return typeof value === 'string' && (REGION_SORTS as readonly string[]).includes(value);
}

export const ENTITIES_EMPTY = 'No hay entidades con este dato en el ámbito elegido.';

/** Entity names repeat across levels only in theory; the level makes the key unique. */
export function entityKey(entity: EntityComparison): string {
  return `${entity.governmentLevel ?? ''}:${entity.entity}`;
}

const projects = (count: number) => `${formatInteger(count)} ${count === 1 ? 'proyecto' : 'proyectos'}`;

/** The figure an entity is ranked by. */
export function entityValue(sort: EntitySort, entity: EntityComparison): string {
  switch (sort) {
    case 'increase-amount':
      return formatSignedSoles(entity.totalCostIncrease);
    case 'increase-pct':
      return formatSignedPercent(entity.costIncreasePct);
    case 'stalled':
      return formatInteger(entity.stalledCount);
    case 'overspent':
      return formatInteger(entity.overspentCount);
  }
}

function detailLine(sort: EntitySort, entity: EntityComparison): string {
  const increased = `${formatInteger(entity.projectsWithIncrease)} con aumento`;
  switch (sort) {
    case 'increase-amount':
      return `${projects(entity.projectCount)} · ${increased}`;
    case 'increase-pct':
      return `${increased} · ${formatSignedSoles(entity.totalCostIncrease)}`;
    case 'stalled':
      return `${projects(entity.projectCount)} · ${formatSolesCompact(entity.stalledPendingAmount)} por ejecutar`;
    case 'overspent':
      return `${projects(entity.projectCount)} · ${formatInteger(entity.stalledCount)} sin gasto reciente`;
  }
}

/**
 * A second factual line. Nationwide it starts with the entity's region, or "Varias regiones" when
 * its projects are in several (ministries).
 */
export function entityDetail(sort: EntitySort, entity: EntityComparison, options: { national?: boolean } = {}): string {
  const line = detailLine(sort, entity);
  return options.national ? withRegion(entity.departmentCode, line) : line;
}

/** The main figure with its unit, for screen readers. */
export function entitySummary(sort: EntitySort, entity: EntityComparison): string {
  const value = entityValue(sort, entity);
  switch (sort) {
    case 'stalled':
      return `${value} sin gasto reciente`;
    case 'overspent':
      return `${value} con gasto sobre el costo`;
    default:
      return value;
  }
}

export function entityNote(sort: EntitySort, options: { national: boolean }): string {
  const rule =
    sort === 'increase-amount'
      ? 'Suma de los aumentos de costo de los proyectos de cada entidad. No descuenta las reducciones.'
      : sort === 'increase-pct'
        ? `${regionNote(sort)} Solo entidades con más de S/ 1 M aprobado en esos proyectos.`
        : regionNote(sort);
  return options.national ? rule : `${rule} Solo cuentan los proyectos de cada entidad en esta región.`;
}
