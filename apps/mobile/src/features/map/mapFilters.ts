import { MAP_FILTERS, type MapFilter } from '@/features/investments/domain/mapPoints';

/**
 * The map filters live in the URL (`/map?f=increase,stalled,overspent`) so a filtered map can be
 * shared. Always in the order of MAP_FILTERS, so equal filters make equal links and query keys.
 */

/** The chips above the map. */
export const MAP_FILTER_OPTIONS: readonly { key: MapFilter; label: string }[] = [
  { key: 'increase', label: 'Con aumento' },
  { key: 'stalled', label: 'Sin gasto reciente' },
  { key: 'overspent', label: 'Gastó más que su costo' },
  { key: 'paralyzed', label: 'Paralizada (Contraloría)' },
];

const canonical = (filters: Iterable<string>): MapFilter[] => {
  const set = new Set(filters);
  return MAP_FILTERS.filter((key) => set.has(key));
};

export function parseMapFilters(raw: string | string[] | undefined): MapFilter[] {
  if (raw === undefined) return [];
  const values = (Array.isArray(raw) ? raw : [raw]).flatMap((value) => value.split(','));
  return canonical(values.map((value) => value.trim()));
}

/** The `f` parameter, or undefined to leave it out. */
export function serializeMapFilters(filters: readonly MapFilter[]): string | undefined {
  const ordered = canonical(filters);
  return ordered.length ? ordered.join(',') : undefined;
}

export function toggleMapFilter(filters: readonly MapFilter[], key: MapFilter): MapFilter[] {
  return filters.includes(key) ? canonical(filters.filter((f) => f !== key)) : canonical([...filters, key]);
}
