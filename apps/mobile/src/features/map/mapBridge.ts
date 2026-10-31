import type { BBox } from '@/features/investments/domain/mapPoints';

/**
 * Typed messages between the app and the MapLibre page (mapHtml.ts), which runs in a WebView on
 * iOS/Android and in an iframe on the web. Everything that arrives from the page is untrusted
 * text: parseMapEvent validates it and drops anything malformed.
 */

/** Page → app. */
export type MapEvent =
  | { type: 'ready' }
  /**
   * After every pan or zoom (MapLibre `moveend`), and once when the map has loaded. `zoom` is the
   * MapLibre zoom (512-px tiles); mapRequest.ts converts it for the server.
   */
  | { type: 'moved'; bbox: BBox; zoom: number }
  | { type: 'pointPressed'; cui: string }
  /** A tap on the map outside any marker. */
  | { type: 'mapPressed' }
  /**
   * The map could not start: MapLibre not loaded (offline, CDN blocked), no WebGL, or the style or
   * first tiles failed. The page adds a `reason` for debugging; it is dropped here.
   */
  | { type: 'loadFailed' };

/** What the page draws. Labels and sizes are computed in the app (mapPresentation.ts). */
export type MapFeature =
  | { kind: 'cluster'; id: string; latitude: number; longitude: number; label: string; radius: number }
  /**
   * `closed`: a closed project (status CERRADO), drawn as a hollow circle. `paralyzed`: in the latest
   * Contraloría edition of paralyzed works, drawn with a signal ring.
   */
  | {
      kind: 'point';
      id: string;
      latitude: number;
      longitude: number;
      increased: boolean;
      closed?: boolean;
      paralyzed?: boolean;
    };

/** App → page. */
export type MapCommand =
  | { type: 'setData'; features: MapFeature[] }
  | { type: 'highlight'; cui: string | null };

/** Where the map opens. */
export type InitialView =
  | { kind: 'bounds'; bbox: BBox }
  | { kind: 'center'; latitude: number; longitude: number; zoom: number };

export const MAX_ZOOM = 22;
const CUI = /^\d{1,12}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function parseBBox(value: unknown): BBox | null {
  if (!isRecord(value)) return null;
  const { minLat, minLon, maxLat, maxLon } = value;
  if (![minLat, minLon, maxLat, maxLon].every(isFiniteNumber)) return null;
  const box = { minLat, minLon, maxLat, maxLon } as BBox;
  const latOk = box.minLat >= -90 && box.maxLat <= 90 && box.minLat <= box.maxLat;
  const lonOk = box.minLon >= -180 && box.maxLon <= 180 && box.minLon <= box.maxLon;
  return latOk && lonOk ? box : null;
}

export function parseMapEvent(raw: unknown): MapEvent | null {
  if (typeof raw !== 'string') return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  switch (data.type) {
    case 'ready':
    case 'mapPressed':
    case 'loadFailed':
      return { type: data.type };
    case 'pointPressed':
      return typeof data.cui === 'string' && CUI.test(data.cui) ? { type: 'pointPressed', cui: data.cui } : null;
    case 'moved': {
      const bbox = parseBBox(data.bbox);
      const { zoom } = data;
      if (!bbox || !isFiniteNumber(zoom) || zoom < 0 || zoom > MAX_ZOOM) return null;
      return { type: 'moved', bbox, zoom };
    }
    default:
      return null;
  }
}

/**
 * JSON that is safe inside an inline <script> and a JavaScript string: `<` cannot close the
 * script, and the line separators JSON allows but older JS engines reject are escaped.
 */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function serializeCommand(command: MapCommand): string {
  return safeJson(command);
}

/** The script injected into the WebView for one command (it must evaluate to true). */
export function commandScript(command: MapCommand): string {
  return `window.fiscusMap && window.fiscusMap.receive(${serializeCommand(command)});true;`;
}
