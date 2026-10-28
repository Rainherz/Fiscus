import { safeJson } from './mapBridge';
import { MAP_ATTRIBUTION, buildMapHtml } from './mapHtml';

describe('buildMapHtml', () => {
  const html = buildMapHtml({ kind: 'bounds', bbox: { minLat: -18.4, minLon: -81.4, maxLat: -0.03, maxLon: -68.6 } });

  it('loads Leaflet from cdnjs with subresource integrity', () => {
    expect(html).toMatch(
      /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet\/1\.9\.4\/leaflet\.js" integrity="sha256-[^"]+" crossorigin="anonymous"/,
    );
    expect(html).toMatch(/<link rel="stylesheet" href="https:\/\/cdnjs[^"]+leaflet\.css" integrity="sha256-[^"]+"/);
  });

  it('uses CARTO light tiles with their attribution, never the OpenStreetMap tile servers', () => {
    expect(html).toContain('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png');
    expect(MAP_ATTRIBUTION).toBe(
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors ' +
        '© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    );
    expect(html).toContain(safeJson(MAP_ATTRIBUTION));
    expect(html).not.toContain('tile.openstreetmap.org');
  });

  it('embeds the initial view', () => {
    expect(html).toContain('"kind":"bounds"');
    const centered = buildMapHtml({ kind: 'center', latitude: -16.4, longitude: -71.5, zoom: 15 });
    expect(centered).toContain('"latitude":-16.4');
  });

  it('reports a failed Leaflet load', () => {
    expect(html).toContain("send({ type: 'loadFailed' })");
  });

  it('has an inline script that parses', () => {
    const inline = /<script>([\s\S]*)<\/script>/.exec(html)?.[1];
    expect(inline).toBeDefined();
    expect(() => new Function(inline!)).not.toThrow();
  });
});
