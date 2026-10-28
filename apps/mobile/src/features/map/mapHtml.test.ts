import { safeJson } from './mapBridge';
import { MAP_ATTRIBUTION, MAP_STYLE_URL, buildMapHtml } from './mapHtml';

describe('buildMapHtml', () => {
  const html = buildMapHtml({ kind: 'bounds', bbox: { minLat: -18.4, minLon: -81.4, maxLat: -0.03, maxLon: -68.6 } });

  it('loads MapLibre GL JS from unpkg, pinned to an exact version with subresource integrity', () => {
    expect(html).toMatch(
      /<script src="https:\/\/unpkg\.com\/maplibre-gl@5\.24\.0\/dist\/maplibre-gl\.js" integrity="sha384-[A-Za-z0-9+/=]{64}" crossorigin="anonymous"><\/script>/,
    );
    expect(html).toMatch(
      /<link rel="stylesheet" href="https:\/\/unpkg\.com\/maplibre-gl@5\.24\.0\/dist\/maplibre-gl\.css" integrity="sha384-[A-Za-z0-9+/=]{64}" crossorigin="anonymous">/,
    );
  });

  it('uses the OpenFreeMap Positron style with its required attribution', () => {
    expect(MAP_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/positron');
    expect(html).toContain(safeJson(MAP_STYLE_URL));
    expect(MAP_ATTRIBUTION).toBe(
      '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ' +
        '<a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> ' +
        'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    );
    expect(html).toContain(safeJson(MAP_ATTRIBUTION));
    expect(html).toContain('new maplibregl.AttributionControl({ compact: false, customAttribution: ATTRIBUTION })');
  });

  it('uses no other tile provider and no Leaflet', () => {
    expect(html).not.toMatch(/carto/i);
    expect(html).not.toContain('tile.openstreetmap.org');
    expect(html).not.toMatch(/leaflet/i);
    expect(html).not.toContain('key=');
  });

  it('draws clusters and points as GeoJSON layers with the style fonts', () => {
    expect(html).toContain("map.addSource('features', { type: 'geojson'");
    for (const layer of ['clusters', 'cluster-labels', 'points', 'point-highlight']) {
      expect(html).toContain(`id: '${layer}'`);
    }
    expect(html).toContain("'text-font': ['Noto Sans Bold']");
  });

  it('embeds the initial view', () => {
    expect(html).toContain('"kind":"bounds"');
    const centered = buildMapHtml({ kind: 'center', latitude: -16.4, longitude: -71.5, zoom: 14 });
    expect(centered).toContain('"latitude":-16.4');
  });

  it('reports a failed load: library, WebGL and style or tiles', () => {
    expect(html).toContain("send({ type: 'loadFailed', reason: 'library' })");
    expect(html).toContain("send({ type: 'loadFailed', reason: 'webgl' })");
    expect(html).toContain("send({ type: 'loadFailed', reason: 'tiles' })");
  });

  it('has an inline script that parses', () => {
    const inline = /<script>([\s\S]*)<\/script>/.exec(html)?.[1];
    expect(inline).toBeDefined();
    expect(() => new Function(inline!)).not.toThrow();
  });
});
