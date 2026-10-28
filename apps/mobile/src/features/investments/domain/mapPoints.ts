import type { GovernmentLevel, LevelFilter } from './governmentLevel';
import type { Investment } from './investment';

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

export interface MapPointsRequest {
  bbox: BBox;
  /** Integer web-mercator zoom. */
  zoom: number;
  level: LevelFilter;
  /** Undefined: all of Peru. */
  departmentCode?: number;
}

export interface MapPoint {
  cui: string;
  name: string | null;
  latitude: number;
  longitude: number;
  governmentLevel: GovernmentLevel | null;
  costIncrease: number | null;
  costIncreasePct: number | null;
  updatedCostValid: boolean;
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

/** What `map_points` returns for these investments (the in-memory adapter's implementation). */
export function computeMapPoints(investments: Investment[], request: MapPointsRequest): MapPoints {
  const inView = investments
    .filter(
      (i) =>
        (request.level === 'ALL' || i.governmentLevel === request.level) &&
        (request.departmentCode === undefined || i.departmentCode === request.departmentCode),
    )
    .flatMap((i) => {
      const point = toMapPoint(i);
      return point ? [point] : [];
    })
    .filter(inBox(request.bbox));
  if (request.zoom >= MAP_POINTS_MIN_ZOOM || inView.length <= MAX_MAP_POINTS) {
    return { kind: 'points', points: inView.sort(byIncrease).slice(0, MAX_MAP_POINTS) };
  }
  return { kind: 'clusters', clusters: cluster(inView, request.zoom) };
}
