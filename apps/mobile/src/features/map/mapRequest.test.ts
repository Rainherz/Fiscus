import { DEPARTMENTS } from '@/features/department/departments';

import { DEPARTMENT_BOUNDS, FOCUS_ZOOM, PERU_VIEW, initialMapView, toMapPointsRequest } from './mapRequest';

const read = { departmentCode: undefined, level: 'ALL' as const };

describe('toMapPointsRequest', () => {
  it('rounds the box outward to two decimals and the zoom down to an integer', () => {
    expect(
      toMapPointsRequest({ bbox: { minLat: -16.4567, minLon: -71.6012, maxLat: -16.3011, maxLon: -71.4499 }, zoom: 12.6 }, read),
    ).toEqual({
      bbox: { minLat: -16.46, minLon: -71.61, maxLat: -16.3, maxLon: -71.44 },
      zoom: 12,
      level: 'ALL',
      departmentCode: undefined,
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

describe('initialMapView', () => {
  it('opens on all of Peru without a department', () => {
    expect(initialMapView({ departmentCode: undefined })).toEqual({ kind: 'bounds', bbox: PERU_VIEW });
  });

  it('opens on the department bounds', () => {
    expect(initialMapView({ departmentCode: 4 })).toEqual({ kind: 'bounds', bbox: DEPARTMENT_BOUNDS[4] });
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
