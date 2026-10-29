import { colors } from '@/shared/theme/tokens';

import { safeJson, type InitialView } from './mapBridge';

/**
 * The MapLibre GL JS page shared by every platform: a WebView loads it as `source={{ html }}` on
 * iOS/Android and an iframe as `srcDoc` on the web. It only draws what the app sends
 * (mapBridge.ts) and reports views and taps; data, labels and states live in the app.
 */

/**
 * MapLibre GL JS 5.24.0, the last line with a classic (UMD) single-file build: the worker is inlined,
 * so the subresource integrity below covers all the code and no module workers are needed (v6 is
 * ESM-only and loads its worker and a shared chunk without integrity). Hashes computed from unpkg
 * and identical on jsDelivr.
 */
const MAPLIBRE = 'https://unpkg.com/maplibre-gl@5.24.0/dist';
const MAPLIBRE_JS_SRI = 'sha384-5+cfbwT0iiub6VsQAdn6yz16nr6sDiQoHx6tm4O8OVYXHYOxcffFmCJBL0dgdvGp';
const MAPLIBRE_CSS_SRI = 'sha384-uTttxo/aOKbdE5RlD/SPzSDoDmNvGlUYPjONi2MN/b7c9HPSvW07OIuyP7uL6jxK';

/** OpenFreeMap Positron: free, no key, no request limits (openfreemap.org). */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/**
 * The attribution OpenFreeMap requires, exactly as its tiles declare it, so MapLibre shows it once
 * even if the style ever stops declaring it.
 */
export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

/**
 * MapLibre zooms (512-px tiles). Clusters zoom in by CLUSTER_ZOOM_STEP on tap, up to POINTS_ZOOM,
 * where the server sends individual projects (its tile zoom 13, see mapRequest.ts).
 */
const CLUSTER_ZOOM_STEP = 2;
const POINTS_ZOOM = 12;
const MIN_ZOOM = 3;
const MAX_ZOOM = 17;
/** Extra px around a tap that still hit a point or cluster. */
const TAP_TOLERANCE = 8;

const STYLE = `
html, body, #map { height: 100%; margin: 0; padding: 0; }
body { background: ${colors.concrete}; }
#map { background: ${colors.concrete}; font-family: -apple-system, Roboto, 'Segoe UI', sans-serif; }
.maplibregl-ctrl-attrib { font-size: 10px; }
`;

/* The page script is plain ES5 so old Android WebViews run it. It uses no template literals. */
const SCRIPT = `
(function () {
  function send(message) {
    var text = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else if (window.parent && window.parent !== window) window.parent.postMessage(text, '*');
  }
  function hasWebGL() {
    try {
      var canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (error) {
      return false;
    }
  }
  if (!window.maplibregl) { send({ type: 'loadFailed', reason: 'library' }); return; }
  if (!hasWebGL()) { send({ type: 'loadFailed', reason: 'webgl' }); return; }

  var options = {
    container: 'map',
    style: STYLE_URL,
    attributionControl: false,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    maxBounds: [[-92, -26], [-58, 7]],
    renderWorldCopies: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    locale: { 'NavigationControl.ZoomIn': 'Acercar', 'NavigationControl.ZoomOut': 'Alejar' }
  };
  if (VIEW.kind === 'center') {
    options.center = [VIEW.longitude, VIEW.latitude];
    options.zoom = VIEW.zoom;
  } else {
    options.bounds = [[VIEW.bbox.minLon, VIEW.bbox.minLat], [VIEW.bbox.maxLon, VIEW.bbox.maxLat]];
  }

  var map;
  try {
    map = new maplibregl.Map(options);
  } catch (error) {
    // The WebGL context could not be created after all.
    send({ type: 'loadFailed', reason: 'webgl' });
    return;
  }
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  // Bottom left: the app shows its status line over the top of the map.
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
  map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: ATTRIBUTION }), 'bottom-right');

  // Until the first complete render, an error (style, fonts, tiles) leaves an empty map: report it.
  // Later tile errors are transient (MapLibre requests them again on the next move).
  var settled = false;
  var failed = false;
  map.once('idle', function () { settled = true; });
  map.on('error', function () {
    if (settled || failed) return;
    failed = true;
    send({ type: 'loadFailed', reason: 'tiles' });
  });

  var IS_CLUSTER = ['==', ['get', 'kind'], 'cluster'];
  var IS_POINT = ['==', ['get', 'kind'], 'point'];
  var INCREASED = ['==', ['get', 'increased'], true];
  var CLOSED = ['==', ['get', 'closed'], true];
  var loaded = false;
  var pending = [];

  function toGeoJson(features) {
    var out = [];
    for (var i = 0; i < features.length; i++) {
      var f = features[i];
      if (!f || !isFinite(f.latitude) || !isFinite(f.longitude) || typeof f.id !== 'string') continue;
      var properties;
      if (f.kind === 'cluster') properties = { kind: 'cluster', id: f.id, label: String(f.label), radius: Number(f.radius) || 14 };
      else if (f.kind === 'point') properties = { kind: 'point', id: f.id, increased: f.increased === true, closed: f.closed === true };
      else continue;
      out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.longitude, f.latitude] }, properties: properties });
    }
    return { type: 'FeatureCollection', features: out };
  }
  function setData(features) {
    map.getSource('features').setData(toGeoJson(features));
  }
  function highlight(cui) {
    map.setFilter('point-highlight', ['all', IS_POINT, ['==', ['get', 'id'], cui || '']]);
  }
  function apply(command) {
    if (command.type === 'setData' && Array.isArray(command.features)) setData(command.features);
    else if (command.type === 'highlight') highlight(typeof command.cui === 'string' ? command.cui : null);
  }
  function receive(command) {
    if (!command || typeof command !== 'object') return;
    if (loaded) apply(command);
    else pending.push(command);
  }
  window.fiscusMap = { receive: receive };
  window.addEventListener('message', function (event) {
    if (event.source !== window.parent || window.parent === window) return;
    try { receive(JSON.parse(event.data)); } catch (error) { /* not a command */ }
  });

  function addLayers() {
    map.addSource('features', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'features',
      filter: IS_CLUSTER,
      paint: {
        'circle-radius': ['-', ['get', 'radius'], 2],
        'circle-color': INK,
        'circle-stroke-color': SIGNAL,
        'circle-stroke-width': 2
      }
    });
    // The style's own fonts (served by OpenFreeMap with the tiles): no DOM marker per cluster.
    map.addLayer({
      id: 'cluster-labels',
      type: 'symbol',
      source: 'features',
      filter: IS_CLUSTER,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
        'text-allow-overlap': true,
        'text-ignore-placement': true
      },
      paint: { 'text-color': SIGNAL }
    });
    // Closed projects: the same sizes, but hollow (no fill, a thicker ink ring).
    map.addLayer({
      id: 'points',
      type: 'circle',
      source: 'features',
      filter: IS_POINT,
      paint: {
        'circle-radius': ['case', INCREASED, 7, 5],
        'circle-color': ['case', INCREASED, SIGNAL, INK],
        'circle-opacity': ['case', CLOSED, 0, 1],
        'circle-stroke-color': INK,
        'circle-stroke-width': ['case', CLOSED, ['case', INCREASED, 3, 2], INCREASED, 2, 1]
      }
    });
    map.addLayer({
      id: 'point-highlight',
      type: 'circle',
      source: 'features',
      filter: ['all', IS_POINT, ['==', ['get', 'id'], '']],
      paint: {
        'circle-radius': ['case', INCREASED, 11, 10],
        'circle-color': ['case', INCREASED, SIGNAL, INK],
        'circle-stroke-color': ['case', INCREASED, INK, SIGNAL],
        'circle-stroke-width': 3
      }
    });
  }

  function sendView() {
    var b = map.getBounds();
    send({
      type: 'moved',
      bbox: { minLat: b.getSouth(), minLon: b.getWest(), maxLat: b.getNorth(), maxLon: b.getEast() },
      zoom: map.getZoom()
    });
  }

  function nearest(hits, point) {
    var best = null;
    var bestDistance = Infinity;
    for (var i = 0; i < hits.length; i++) {
      var at = map.project(hits[i].geometry.coordinates);
      var distance = Math.pow(at.x - point.x, 2) + Math.pow(at.y - point.y, 2);
      if (distance < bestDistance) { best = hits[i]; bestDistance = distance; }
    }
    return best;
  }

  map.on('load', function () {
    addLayers();
    loaded = true;
    for (var i = 0; i < pending.length; i++) apply(pending[i]);
    pending = [];
    send({ type: 'ready' });
    sendView();
    map.on('moveend', sendView);
  });

  map.on('click', function (event) {
    if (!loaded) return;
    var p = event.point;
    var box = [[p.x - TAP_TOLERANCE, p.y - TAP_TOLERANCE], [p.x + TAP_TOLERANCE, p.y + TAP_TOLERANCE]];
    var point = nearest(map.queryRenderedFeatures(box, { layers: ['points'] }), p);
    if (point) { send({ type: 'pointPressed', cui: point.properties.id }); return; }
    var cluster = nearest(map.queryRenderedFeatures(box, { layers: ['clusters'] }), p);
    if (cluster) {
      var zoom = map.getZoom();
      map.easeTo({ center: cluster.geometry.coordinates, zoom: Math.max(zoom, Math.min(zoom + CLUSTER_ZOOM_STEP, POINTS_ZOOM)) });
      return;
    }
    send({ type: 'mapPressed' });
  });

  ['points', 'clusters'].forEach(function (layer) {
    map.on('mouseenter', layer, function () { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, function () { map.getCanvas().style.cursor = ''; });
  });
})();
`;

export function buildMapHtml(view: InitialView): string {
  const constants = [
    `var VIEW = ${safeJson(view)};`,
    `var STYLE_URL = ${safeJson(MAP_STYLE_URL)};`,
    `var ATTRIBUTION = ${safeJson(MAP_ATTRIBUTION)};`,
    `var INK = ${safeJson(colors.ink)};`,
    `var SIGNAL = ${safeJson(colors.signal)};`,
    `var CLUSTER_ZOOM_STEP = ${CLUSTER_ZOOM_STEP};`,
    `var POINTS_ZOOM = ${POINTS_ZOOM};`,
    `var MIN_ZOOM = ${MIN_ZOOM};`,
    `var MAX_ZOOM = ${MAX_ZOOM};`,
    `var TAP_TOLERANCE = ${TAP_TOLERANCE};`,
  ].join('\n');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE}/maplibre-gl.css" integrity="${MAPLIBRE_CSS_SRI}" crossorigin="anonymous">
<style>${STYLE}</style>
</head>
<body>
<div id="map"></div>
<script src="${MAPLIBRE}/maplibre-gl.js" integrity="${MAPLIBRE_JS_SRI}" crossorigin="anonymous"></script>
<script>
${constants}
${SCRIPT}
</script>
</body>
</html>`;
}
