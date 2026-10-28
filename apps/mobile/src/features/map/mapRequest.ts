import type { LevelFilter } from '@/features/investments/domain/governmentLevel';
import type { Coordinates } from '@/features/investments/domain/investment';
import {
  PERU_BBOX,
  type BBox,
  type MapFilter,
  type MapListRequest,
  type MapPointsRequest,
} from '@/features/investments/domain/mapPoints';

import type { InitialView } from './mapBridge';

/** The country on screen when the map opens nationwide. */
export const PERU_VIEW: BBox = { minLat: -18.4, minLon: -81.4, maxLat: -0.03, maxLon: -68.6 };

/**
 * Close enough to see the project's street and its neighbors as individual points (a MapLibre zoom,
 * like every zoom the page uses).
 */
export const FOCUS_ZOOM = 14;

/** The largest zoom map_points accepts. */
const MAX_TILE_ZOOM = 22;

/**
 * MapLibre zooms count 512-px tiles; map_points sizes its grid cells on 256-px tiles (a quarter
 * tile, `360 / 2^zoom / 4` degrees), as Leaflet zooms did. One level up keeps a cell at 64 px on
 * screen. Rounded down to an integer.
 */
export function toTileZoom(maplibreZoom: number): number {
  return Math.min(Math.max(0, Math.floor(maplibreZoom + 1)), MAX_TILE_ZOOM);
}

const box = (minLat: number, maxLat: number, minLon: number, maxLon: number): BBox => ({
  minLat,
  minLon,
  maxLat,
  maxLon,
});

/**
 * Approximate bounding boxes of the departments (rounded to 0.1°), only to frame the map when a
 * department is the scope. Keyed by the MEF codes of departments.ts.
 */
export const DEPARTMENT_BOUNDS: Record<number, BBox> = {
  1: box(-7.2, -2.9, -78.7, -77.1), // Amazonas
  2: box(-10.8, -7.8, -78.7, -76.7), // Áncash
  3: box(-14.9, -13.1, -73.9, -72.0), // Apurímac
  4: box(-17.3, -14.6, -75.1, -70.8), // Arequipa
  5: box(-15.6, -11.9, -75.2, -73.4), // Ayacucho
  6: box(-7.8, -4.6, -79.5, -77.7), // Cajamarca
  7: box(-12.2, -11.8, -77.2, -77.0), // Callao
  8: box(-15.5, -11.2, -74.0, -70.3), // Cusco
  9: box(-14.1, -11.9, -75.8, -74.0), // Huancavelica
  10: box(-10.5, -8.3, -77.3, -74.6), // Huánuco
  11: box(-15.5, -12.9, -76.4, -74.6), // Ica
  12: box(-12.7, -10.7, -76.5, -73.4), // Junín
  13: box(-9.0, -6.9, -79.7, -76.9), // La Libertad
  14: box(-7.2, -5.4, -80.7, -79.1), // Lambayeque
  15: box(-13.4, -10.2, -77.9, -75.5), // Lima
  16: box(-8.7, -0.03, -77.9, -69.9), // Loreto
  17: box(-13.4, -9.9, -72.5, -68.6), // Madre de Dios
  18: box(-17.8, -15.9, -71.5, -70.0), // Moquegua
  19: box(-11.1, -9.8, -76.7, -74.2), // Pasco
  20: box(-6.4, -4.1, -81.4, -79.2), // Piura
  21: box(-17.3, -13.0, -71.2, -68.8), // Puno
  22: box(-8.8, -5.4, -77.8, -75.5), // San Martín
  23: box(-18.4, -16.6, -71.1, -69.5), // Tacna
  24: box(-4.3, -3.4, -81.0, -80.1), // Tumbes
  25: box(-11.5, -7.3, -75.0, -70.4), // Ucayali
};

export function initialMapView(params: { departmentCode: number | undefined; focus?: Coordinates | null }): InitialView {
  if (params.focus) {
    return { kind: 'center', latitude: params.focus.latitude, longitude: params.focus.longitude, zoom: FOCUS_ZOOM };
  }
  const department = params.departmentCode === undefined ? undefined : DEPARTMENT_BOUNDS[params.departmentCode];
  return { kind: 'bounds', bbox: department ?? PERU_VIEW };
}

const down = (value: number) => Math.floor(value * 100) / 100;
const up = (value: number) => Math.ceil(value * 100) / 100;

/**
 * The query for one map view: the box clipped to where coordinates exist and rounded outward
 * (small pans reuse the cached answer), the zoom as the integer tile zoom of the server. Null when
 * nothing can be in view.
 */
function queryBox(view: BBox): BBox | null {
  const bbox: BBox = {
    minLat: Math.max(down(view.minLat), PERU_BBOX.minLat),
    minLon: Math.max(down(view.minLon), PERU_BBOX.minLon),
    maxLat: Math.min(up(view.maxLat), PERU_BBOX.maxLat),
    maxLon: Math.min(up(view.maxLon), PERU_BBOX.maxLon),
  };
  return bbox.minLat > bbox.maxLat || bbox.minLon > bbox.maxLon ? null : bbox;
}

type ReadScope = { departmentCode: number | undefined; level: LevelFilter };

export function toMapPointsRequest(
  view: { bbox: BBox; zoom: number },
  read: ReadScope,
  filters: readonly MapFilter[] = [],
): MapPointsRequest | null {
  const bbox = queryBox(view.bbox);
  if (!bbox) return null;
  return {
    bbox,
    zoom: toTileZoom(view.zoom),
    level: read.level,
    departmentCode: read.departmentCode,
    filters,
  };
}

/** The list of the same view (every page): the same box, scope and filters as the map. */
export function toMapListRequest(
  view: { bbox: BBox; zoom: number },
  read: ReadScope,
  filters: readonly MapFilter[],
): Omit<MapListRequest, 'page'> | null {
  const bbox = queryBox(view.bbox);
  if (!bbox) return null;
  return { bbox, level: read.level, departmentCode: read.departmentCode, filters };
}
