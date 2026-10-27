import { DEPARTMENTS } from '../department/departments';
import { departmentCodeOf, type Scope } from '../department/scope';
import { rankRegions, type RegionComparison } from '../investments/domain/regionComparison';

/** The two departments compared: `a` on the left, `b` on the right. */
export interface RegionPair {
  a: number;
  b: number;
}

export interface PartialPair {
  a: number | null;
  b: number | null;
}

/** A department code from a URL parameter (`?a=4`), or null when missing or unknown. */
export function parseRegionCode(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || !/^\d{1,2}$/.test(value)) return null;
  const code = Number(value);
  return DEPARTMENTS.some((d) => d.code === code) ? code : null;
}

/** Defaults depend on the comparison data only when a side is missing from the URL. */
export function needsComparisonData(pair: PartialPair): boolean {
  return pair.a === null || pair.b === null;
}

/** Departments by total cost increase, largest first; those without data follow in code order. */
function defaultOrder(regions: readonly RegionComparison[]): number[] {
  const ranked = rankRegions(regions, 'increase-amount').map((r) => r.departmentCode);
  const present = new Set(ranked);
  return [...ranked, ...DEPARTMENTS.map((d) => d.code).filter((code) => !present.has(code))];
}

/**
 * Completes the pair from the URL. A missing `a` is the current department (when the scope is one)
 * or the region with the largest total increase; a missing `b` is the next one by total increase.
 * A missing side never repeats the other one; two equal codes from the URL are kept as given.
 */
export function resolvePair(params: PartialPair & { scope: Scope; regions: readonly RegionComparison[] }): RegionPair {
  const order = defaultOrder(params.regions);
  const firstExcept = (other: number | null) => order.find((code) => code !== other) as number;
  const current = departmentCodeOf(params.scope);
  const a =
    params.a ?? (current !== undefined && current !== params.b ? current : firstExcept(params.b));
  const b = params.b ?? firstExcept(a);
  return { a, b };
}

export function swapPair(pair: RegionPair): RegionPair {
  return { a: pair.b, b: pair.a };
}

/** Link to the comparison; sides left out are chosen by default there. */
export function compareHref(pair: { a?: number; b?: number } = {}) {
  const params: { a?: string; b?: string } = {};
  if (pair.a !== undefined) params.a = String(pair.a);
  if (pair.b !== undefined) params.b = String(pair.b);
  return { pathname: '/compare' as const, params };
}
