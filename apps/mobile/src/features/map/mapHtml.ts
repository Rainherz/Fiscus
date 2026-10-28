import { colors } from '@/shared/theme/tokens';

import { safeJson, type InitialView } from './mapBridge';

/**
 * The Leaflet page shared by every platform: a WebView loads it as `source={{ html }}` on
 * iOS/Android and an iframe as `srcDoc` on the web. It only draws what the app sends
 * (mapBridge.ts) and reports views and taps; data, labels and states live in the app.
 */

const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4';
/** Subresource integrity of Leaflet 1.9.4 (identical on cdnjs and unpkg). */
const LEAFLET_JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
const LEAFLET_CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';

/**
 * CARTO Positron, with attribution (the OSM tile servers forbid app traffic). CARTO watermarks
 * tiles requested without a basemaps key ("API key required"); its free tiers need one.
 */
export const CARTO_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
export const MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors ' +
  '© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

/** Clusters zoom in by this much on tap, up to the zoom where points show. */
const CLUSTER_ZOOM_STEP = 2;
const POINTS_ZOOM = 13;

const STYLE = `
html, body, #map { height: 100%; margin: 0; padding: 0; }
body { background: ${colors.concrete}; }
.leaflet-container { background: ${colors.concrete}; font-family: -apple-system, Roboto, 'Segoe UI', sans-serif; }
.fiscus-cluster { display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  border-radius: 50%; background: ${colors.ink}; color: ${colors.signal}; border: 2px solid ${colors.signal};
  font: 700 12px/1 ui-monospace, Menlo, 'Roboto Mono', monospace; white-space: nowrap; }
.leaflet-control-attribution { font-size: 10px; }
.leaflet-bar a { color: ${colors.ink}; }
`;

/* The page script is plain ES5 so old Android WebViews run it. It uses no template literals. */
const SCRIPT = `
(function () {
  var INK = '${colors.ink}';
  var SIGNAL = '${colors.signal}';
  function send(message) {
    var text = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else if (window.parent && window.parent !== window) window.parent.postMessage(text, '*');
  }
  if (!window.L) { send({ type: 'loadFailed' }); return; }

  var map = L.map('map', {
    preferCanvas: true,
    zoomControl: false,
    minZoom: 4,
    maxZoom: 18,
    maxBounds: [[-26, -92], [7, -58]],
    maxBoundsViscosity: 0.8
  });
  // Bottom left: the app shows its status line over the top of the map.
  L.control.zoom({ position: 'bottomleft', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  L.tileLayer(TILES, { subdomains: 'abcd', maxZoom: 20, attribution: ATTRIBUTION }).addTo(map);

  var renderer = L.canvas({ padding: 0.5, tolerance: 8 });
  var layer = L.layerGroup().addTo(map);
  var points = {};
  var highlighted = null;

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pointStyle(feature, on) {
    if (feature.increased) {
      return { radius: on ? 11 : 7, color: INK, weight: on ? 3 : 2, fillColor: SIGNAL, fillOpacity: 1 };
    }
    return { radius: on ? 10 : 5, color: on ? SIGNAL : INK, weight: on ? 3 : 1, fillColor: INK, fillOpacity: 1 };
  }
  function addCluster(feature) {
    var size = feature.radius * 2;
    var icon = L.divIcon({
      className: 'fiscus-cluster',
      html: escapeHtml(feature.label),
      iconSize: [size, size]
    });
    L.marker([feature.latitude, feature.longitude], { icon: icon, keyboard: false })
      .on('click', function () {
        map.setView([feature.latitude, feature.longitude], Math.min(map.getZoom() + CLUSTER_ZOOM_STEP, POINTS_ZOOM));
      })
      .addTo(layer);
  }
  function addPoint(feature) {
    var options = pointStyle(feature, feature.id === highlighted);
    options.renderer = renderer;
    options.bubblingMouseEvents = false;
    var marker = L.circleMarker([feature.latitude, feature.longitude], options)
      .on('click', function () { send({ type: 'pointPressed', cui: feature.id }); })
      .addTo(layer);
    points[feature.id] = { marker: marker, feature: feature };
  }
  function setData(features) {
    layer.clearLayers();
    points = {};
    for (var i = 0; i < features.length; i++) {
      var feature = features[i];
      if (!feature || typeof feature.latitude !== 'number' || typeof feature.longitude !== 'number') continue;
      if (feature.kind === 'cluster') addCluster(feature);
      else if (feature.kind === 'point') addPoint(feature);
    }
    if (highlighted && points[highlighted]) points[highlighted].marker.bringToFront();
  }
  function highlight(cui) {
    var previous = highlighted;
    highlighted = cui;
    [previous, cui].forEach(function (id) {
      if (id && points[id]) points[id].marker.setStyle(pointStyle(points[id].feature, id === highlighted));
    });
    if (cui && points[cui]) points[cui].marker.bringToFront();
  }
  function receive(command) {
    if (!command || typeof command !== 'object') return;
    if (command.type === 'setData' && Array.isArray(command.features)) setData(command.features);
    else if (command.type === 'highlight') highlight(typeof command.cui === 'string' ? command.cui : null);
  }
  window.fiscusMap = { receive: receive };
  window.addEventListener('message', function (event) {
    if (event.source !== window.parent || window.parent === window) return;
    try { receive(JSON.parse(event.data)); } catch (error) { /* not a command */ }
  });

  map.on('moveend', function () {
    var b = map.getBounds();
    send({
      type: 'moved',
      bbox: { minLat: b.getSouth(), minLon: b.getWest(), maxLat: b.getNorth(), maxLon: b.getEast() },
      zoom: map.getZoom()
    });
  });
  map.on('click', function () { send({ type: 'mapPressed' }); });

  send({ type: 'ready' });
  if (VIEW.kind === 'center') map.setView([VIEW.latitude, VIEW.longitude], VIEW.zoom);
  else map.fitBounds([[VIEW.bbox.minLat, VIEW.bbox.minLon], [VIEW.bbox.maxLat, VIEW.bbox.maxLon]]);
})();
`;

export function buildMapHtml(view: InitialView, options: { tilesKey?: string } = {}): string {
  const tiles = options.tilesKey ? `${CARTO_TILES}?key=${encodeURIComponent(options.tilesKey)}` : CARTO_TILES;
  const constants = [
    `var VIEW = ${safeJson(view)};`,
    `var TILES = ${safeJson(tiles)};`,
    `var ATTRIBUTION = ${safeJson(MAP_ATTRIBUTION)};`,
    `var CLUSTER_ZOOM_STEP = ${CLUSTER_ZOOM_STEP};`,
    `var POINTS_ZOOM = ${POINTS_ZOOM};`,
  ].join('\n');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css" integrity="${LEAFLET_CSS_SRI}" crossorigin="anonymous">
<style>${STYLE}</style>
</head>
<body>
<div id="map"></div>
<script src="${LEAFLET}/leaflet.js" integrity="${LEAFLET_JS_SRI}" crossorigin="anonymous"></script>
<script>
${constants}
${SCRIPT}
</script>
</body>
</html>`;
}
