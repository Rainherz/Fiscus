import type { GovernmentLevel, LevelFilter } from './governmentLevel';
import type { Investment } from './investment';
import { isClosed, matchesStatus, type StatusFilter } from './investmentStatus';
import { stalledStatus } from './stalled';

/**
 * The map: projects with coordinates (open data), as grid clusters or individual points. The
 * rules mirror the `map_points` SQL function so the demo mode behaves like production.
 */

/** Degrees; latitudes are negative in Peru. */
export interface BBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

/** Bounds of every stored coordinate (the investments check constraints). */
export const PERU_BBOX: BBox = { minLat: -19, minLon: -82, maxLat: 0, maxLon: -68 };

/**
 * Filters of the map and its list, combined with AND (the `only_*` arguments of map_points and
 * map_list):
 * - increase: a positive cost increase on a valid updated cost ("Con aumento").
 * - stalled: "Sin gasto reciente" (see stalled.ts).
 * - overspent: the accrued total exceeds a valid updated cost ("Gastó más que su costo").
 */
export type MapFilter = 'increase' | 'stalled' | 'overspent';
export const MAP_FILTERS: readonly MapFilter[] = ['increase', 'stalled', 'overspent'];

export interface MapPointsRequest {
  bbox: BBox;
  /** Integer web-mercator zoom. */
  zoom: number;
  level: LevelFilter;
  /** Undefined: all of Peru. */
  departmentCode?: number;
  /** None (or undefined): every project. */
  filters?: readonly MapFilter[];
  /** Undefined or 'ALL': every status (the `status_filter` argument). */
  status?: StatusFilter;
}

/** One page of the list beside the map: the projects of the view that match the filters. */
export interface MapListRequest {
  bbox: BBox;
  level: LevelFilter;
  departmentCode?: number;
  filters?: readonly MapFilter[];
  status?: StatusFilter;
  page: number;
  pageSize?: number;
}

export const MAP_LIST_PAGE_SIZE = 30;

export interface MapPoint {
  cui: string;
  name: string | null;
  latitude: number;
  longitude: number;
  governmentLevel: GovernmentLevel | null;
  costIncrease: number | null;
  costIncreasePct: number | null;
  updatedCostValid: boolean;
  /** A closed project (status CERRADO): drawn with its own marker. */
  closed?: boolean;
}

export interface MapCluster {
  /** Centroid of the cell's projects. */
  latitude: number;
  longitude: number;
  count: number;
  /** Sum of the positive, valid cost increases in the cell (0 when none). */
  totalCostIncrease: number;
  /** Largest valid percentage in the cell, or null without valid costs. */
  maxCostIncreasePct: number | null;
  /** Projects with a positive, valid cost increase. */
  increasedCount: number;
}

/** A row of the list (and what the card shows): `map_list`. */
export interface MapListItem extends MapPoint {
  entity: string | null;
  status: string | null;
  updatedCost: number | null;
  accruedTotal: number | null;
  executionProgress: number | null;
  spentAnomaly: boolean;
  /** 0-100, as MEF publishes it; null when not reported. */
  physicalProgress: number | null;
  lastAccrualMonth: string | null;
  /** Meets the "Sin gasto reciente" rule. */
  stalled: boolean;
}

export interface MapListPage {
  items: MapListItem[];
  /** Matching projects in the view (every page). */
  total: number;
}

export type MapPoints = { kind: 'points'; points: MapPoint[] } | { kind: 'clusters'; clusters: MapCluster[] };

/** Individual projects from this zoom on, or whenever the view holds at most MAX_MAP_POINTS. */
export const MAP_POINTS_MIN_ZOOM = 13;
export const MAX_MAP_POINTS = 500;
export const MAX_MAP_CELLS = 400;

/** A quarter of a 256 px web-mercator tile, in degrees: cells of about 64 px on screen. */
export function clusterCellSize(zoom: number): number {
  return 360 / 2 ** zoom / 4;
}

/** A positive cost increase on a valid updated cost (what cluster totals add up). */
export function hasValidIncrease(point: Pick<MapPoint, 'costIncrease' | 'updatedCostValid'>): boolean {
  return point.updatedCostValid && (point.costIncrease ?? 0) > 0;
}

export function toMapPoint(investment: Investment): MapPoint | null {
  if (!investment.coordinates) return null;
  return {
    cui: investment.cui,
    name: investment.name,
    latitude: investment.coordinates.latitude,
    longitude: investment.coordinates.longitude,
    governmentLevel: investment.governmentLevel,
    costIncrease: investment.costIncrease,
    costIncreasePct: investment.costIncreasePct,
    updatedCostValid: investment.updatedCostValid,
    closed: isClosed(investment),
  };
}

const inBox = (box: BBox) => (p: MapPoint) =>
  p.latitude >= box.minLat && p.latitude <= box.maxLat && p.longitude >= box.minLon && p.longitude <= box.maxLon;

/** Largest increase first (nulls last), then CUI, like the SQL function. */
function byIncrease(a: MapPoint, b: MapPoint): number {
  if (a.costIncrease !== b.costIncrease) {
    if (a.costIncrease === null) return 1;
    if (b.costIncrease === null) return -1;
    return b.costIncrease - a.costIncrease;
  }
  return a.cui < b.cui ? -1 : a.cui > b.cui ? 1 : 0;
}

function cluster(points: MapPoint[], zoom: number): MapCluster[] {
  const cell = clusterCellSize(zoom);
  const cells = new Map<string, MapPoint[]>();
  for (const point of points) {
    const key = `${Math.floor(point.latitude / cell)}:${Math.floor(point.longitude / cell)}`;
    cells.set(key, [...(cells.get(key) ?? []), point]);
  }
  return [...cells.values()]
    .map((group) => {
      const increased = group.filter(hasValidIncrease);
      const pcts = group.flatMap((p) => (p.updatedCostValid && p.costIncreasePct !== null ? [p.costIncreasePct] : []));
      return {
        latitude: group.reduce((sum, p) => sum + p.latitude, 0) / group.length,
        longitude: group.reduce((sum, p) => sum + p.longitude, 0) / group.length,
        count: group.length,
        totalCostIncrease: increased.reduce((sum, p) => sum + (p.costIncrease ?? 0), 0),
        maxCostIncreasePct: pcts.length ? Math.max(...pcts) : null,
        increasedCount: increased.length,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_MAP_CELLS);
}

/** The latest last accrual month of the dataset (accrual_reference_month_all_levels). */
function referenceMonthOf(investments: Investment[]): string | null {
  return investments.reduce<string | null>(
    (latest, i) => (i.lastAccrualMonth !== null && (latest === null || i.lastAccrualMonth > latest) ? i.lastAccrualMonth : latest),
    null,
  );
}

function isOverspent(i: Investment): boolean {
  return i.updatedCostValid && (i.executionProgress ?? 0) > 1;
}

type Scoped = Pick<MapPointsRequest, 'bbox' | 'level' | 'departmentCode' | 'filters' | 'status'>;

/** The located investments of the request's box and scope that match its filters. */
function located(investments: Investment[], request: Scoped): { investment: Investment; point: MapPoint; stalled: boolean }[] {
  const referenceMonth = referenceMonthOf(investments);
  const filters = request.filters ?? [];
  const within = inBox(request.bbox);
  return investments.flatMap((investment) => {
    if (request.level !== 'ALL' && investment.governmentLevel !== request.level) return [];
    if (request.departmentCode !== undefined && investment.departmentCode !== request.departmentCode) return [];
    if (!matchesStatus(investment.status, request.status)) return [];
    const point = toMapPoint(investment);
    if (!point || !within(point)) return [];
    const stalled = stalledStatus(investment, referenceMonth) !== null;
    if (filters.includes('increase') && !hasValidIncrease(point)) return [];
    if (filters.includes('stalled') && !stalled) return [];
    if (filters.includes('overspent') && !isOverspent(investment)) return [];
    return [{ investment, point, stalled }];
  });
}

/** What `map_points` returns for these investments (the in-memory adapter's implementation). */
export function computeMapPoints(investments: Investment[], request: MapPointsRequest): MapPoints {
  const inView = located(investments, request).map(({ point }) => point);
  if (request.zoom >= MAP_POINTS_MIN_ZOOM || inView.length <= MAX_MAP_POINTS) {
    return { kind: 'points', points: inView.sort(byIncrease).slice(0, MAX_MAP_POINTS) };
  }
  return { kind: 'clusters', clusters: cluster(inView, request.zoom) };
}

function listItem(i: Investment, point: MapPoint, stalled: boolean): MapListItem {
  return {
    ...point,
    entity: i.entity,
    status: i.status,
    updatedCost: i.updatedCost,
    accruedTotal: i.accruedTotal,
    executionProgress: i.executionProgress,
    spentAnomaly: i.spentAnomaly,
    physicalProgress: i.physicalProgress,
    lastAccrualMonth: i.lastAccrualMonth,
    stalled,
  };
}

/** The list row (and card figures) of a project read by CUI; null without coordinates. */
export function toMapListItem(investment: Investment, referenceMonth: string | null): MapListItem | null {
  const point = toMapPoint(investment);
  return point ? listItem(investment, point, stalledStatus(investment, referenceMonth) !== null) : null;
}

const compareNullsLast = (a: number | null, b: number | null): number => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
};

/** What `map_list` returns for these investments (the in-memory adapter's implementation). */
export function computeMapList(investments: Investment[], request: MapListRequest): MapListPage {
  const pageSize = request.pageSize ?? MAP_LIST_PAGE_SIZE;
  const items = located(investments, request)
    .map(({ investment, point, stalled }) => listItem(investment, point, stalled))
    .sort(
      (a, b) =>
        compareNullsLast(a.costIncrease, b.costIncrease) ||
        compareNullsLast(a.updatedCost, b.updatedCost) ||
        (a.cui < b.cui ? -1 : a.cui > b.cui ? 1 : 0),
    );
  return { items: items.slice(request.page * pageSize, (request.page + 1) * pageSize), total: items.length };
}
