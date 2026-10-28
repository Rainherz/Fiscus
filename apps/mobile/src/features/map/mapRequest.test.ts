import { DEPARTMENTS } from '@/features/department/departments';

import {
  DEPARTMENT_BOUNDS,
  FOCUS_ZOOM,
  PERU_VIEW,
  initialMapView,
  toMapListRequest,
  toMapPointsRequest,
  toTileZoom,
} from './mapRequest';

const read = { departmentCode: undefined, level: 'ALL' as const };

describe('toMapPointsRequest', () => {
  it('rounds the box outward to two decimals and sends the 256-px tile zoom as an integer', () => {
    expect(
      toMapPointsRequest({ bbox: { minLat: -16.4567, minLon: -71.6012, maxLat: -16.3011, maxLon: -71.4499 }, zoom: 12.6 }, read),
    ).toEqual({
      bbox: { minLat: -16.46, minLon: -71.61, maxLat: -16.3, maxLon: -71.44 },
      zoom: 13,
      level: 'ALL',
      departmentCode: undefined,
      filters: [],
    });
  });

  it('clips the box to where coordinates exist', () => {
    const request = toMapPointsRequest({ bbox: { minLat: -40, minLon: -100, maxLat: 10, maxLon: -50 }, zoom: 3 }, read);
    expect(request?.bbox).toEqual({ minLat: -19, minLon: -82, maxLat: 0, maxLon: -68 });
  });

  it('asks for nothing when the view is outside Peru', () => {
    expect(toMapPointsRequest({ bbox: { minLat: 10, minLon: -80, maxLat: 12, maxLon: -78 }, zoom: 8 }, read)).toBeNull();
  });

  it('passes the scope: department and level', () => {
    const request = toMapPointsRequest(
      { bbox: { minLat: -17, minLon: -73, maxLat: -15, maxLon: -71 }, zoom: 7 },
      { departmentCode: 4, level: 'GL' },
    );
    expect(request).toEqual(expect.objectContaining({ departmentCode: 4, level: 'GL' }));
  });
});

describe('map filters in requests', () => {
  const view = { bbox: { minLat: -16.4567, minLon: -71.6012, maxLat: -16.3011, maxLon: -71.4499 }, zoom: 9 };

  it('sends the filters to the map points', () => {
    expect(toMapPointsRequest(view, read, ['increase', 'stalled'])?.filters).toEqual(['increase', 'stalled']);
  });

  it('asks the list for the same rounded box, scope and filters, without zoom', () => {
    expect(toMapListRequest(view, { departmentCode: 4, level: 'GR' }, ['overspent'])).toEqual({
      bbox: { minLat: -16.46, minLon: -71.61, maxLat: -16.3, maxLon: -71.44 },
      level: 'GR',
      departmentCode: 4,
      filters: ['overspent'],
    });
  });

  it('asks the list for nothing outside Peru', () => {
    expect(toMapListRequest({ bbox: { minLat: 10, minLon: -80, maxLat: 12, maxLon: -78 }, zoom: 8 }, read, [])).toBeNull();
  });
});

describe('toTileZoom', () => {
  // MapLibre zooms count 512-px tiles; map_points sizes its cells on 256-px tiles (the zooms Leaflet used).
  it('is one level above the MapLibre zoom, rounded down', () => {
    expect(toTileZoom(0)).toBe(1);
    expect(toTileZoom(4.99)).toBe(5);
    expect(toTileZoom(11.6)).toBe(12);
    expect(toTileZoom(12)).toBe(13);
  });

  it('never goes below zero or above the largest server zoom', () => {
    expect(toTileZoom(-3)).toBe(0);
    expect(toTileZoom(22)).toBe(22);
  });

  it('keeps a cluster cell (a quarter tile) at the same 64 px on screen', () => {
    const cellDegrees = (tileZoom: number) => 360 / 2 ** tileZoom / 4;
    const maplibrePxPerDegree = (zoom: number) => (512 * 2 ** zoom) / 360;
    expect(cellDegrees(toTileZoom(7)) * maplibrePxPerDegree(7)).toBeCloseTo(64);
  });
});

describe('initialMapView', () => {
  it('opens on all of Peru without a department', () => {
    expect(initialMapView({ departmentCode: undefined })).toEqual({ kind: 'bounds', bbox: PERU_VIEW });
  });

  it('opens on the department bounds', () => {
    expect(initialMapView({ departmentCode: 4 })).toEqual({ kind: 'bounds', bbox: DEPARTMENT_BOUNDS[4] });
  });

  it('focuses close enough for the server to send individual projects', () => {
    expect(toTileZoom(FOCUS_ZOOM)).toBeGreaterThanOrEqual(13);
    expect(FOCUS_ZOOM).toBe(14);
  });

  it('centers on a project with coordinates, whatever the scope', () => {
    expect(initialMapView({ departmentCode: 8, focus: { latitude: -16.4, longitude: -71.5 } })).toEqual({
      kind: 'center',
      latitude: -16.4,
      longitude: -71.5,
      zoom: FOCUS_ZOOM,
    });
  });

  it('has bounds inside Peru for every department', () => {
    for (const { code } of DEPARTMENTS) {
      const box = DEPARTMENT_BOUNDS[code];
      expect(box.minLat).toBeLessThan(box.maxLat);
      expect(box.minLon).toBeLessThan(box.maxLon);
      expect(box.minLat).toBeGreaterThanOrEqual(PERU_VIEW.minLat);
      expect(box.maxLat).toBeLessThanOrEqual(PERU_VIEW.maxLat);
      expect(box.minLon).toBeGreaterThanOrEqual(PERU_VIEW.minLon);
      expect(box.maxLon).toBeLessThanOrEqual(PERU_VIEW.maxLon);
    }
  });
});
