import { commandScript, parseMapEvent, serializeCommand } from './mapBridge';

const moved = {
  type: 'moved',
  bbox: { minLat: -17.2, minLon: -73.1, maxLat: -15.1, maxLon: -70.9 },
  zoom: 7.4,
};

describe('parseMapEvent', () => {
  it('parses the map events', () => {
    expect(parseMapEvent('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(parseMapEvent(JSON.stringify(moved))).toEqual(moved);
    expect(parseMapEvent('{"type":"pointPressed","cui":"2088142"}')).toEqual({ type: 'pointPressed', cui: '2088142' });
    expect(parseMapEvent('{"type":"mapPressed"}')).toEqual({ type: 'mapPressed' });
    expect(parseMapEvent('{"type":"loadFailed"}')).toEqual({ type: 'loadFailed' });
  });

  it('keeps only the known fields', () => {
    expect(parseMapEvent('{"type":"ready","extra":1}')).toEqual({ type: 'ready' });
  });

  it.each([
    ['not JSON', 'hello'],
    ['not an object', '42'],
    ['null', 'null'],
    ['an unknown type', '{"type":"explode"}'],
    ['a missing type', '{"cui":"1"}'],
    ['a non-string payload', 12],
    ['a CUI that is not digits', '{"type":"pointPressed","cui":"<script>"}'],
    ['a missing CUI', '{"type":"pointPressed"}'],
    ['a missing bbox', '{"type":"moved","zoom":5}'],
    ['a non-numeric bound', JSON.stringify({ ...moved, bbox: { ...moved.bbox, minLat: '-17' } })],
    ['an inverted bbox', JSON.stringify({ ...moved, bbox: { ...moved.bbox, minLat: -10, maxLat: -12 } })],
    ['a latitude out of range', JSON.stringify({ ...moved, bbox: { ...moved.bbox, minLat: -95 } })],
    ['a zoom out of range', JSON.stringify({ ...moved, zoom: 40 })],
    ['a missing zoom', JSON.stringify({ type: 'moved', bbox: moved.bbox })],
  ])('rejects %s', (_label, raw) => {
    expect(parseMapEvent(raw)).toBeNull();
  });
});

describe('serializeCommand / commandScript', () => {
  it('serializes a command as JSON', () => {
    expect(JSON.parse(serializeCommand({ type: 'highlight', cui: '1' }))).toEqual({ type: 'highlight', cui: '1' });
  });

  it('escapes characters that could close the script or break the line', () => {
    const json = serializeCommand({
      type: 'setData',
      features: [{ kind: 'point', id: '</script>\u2028', latitude: -16, longitude: -71, increased: true }],
    });
    expect(json).not.toContain('</script>');
    expect(json).not.toContain('\u2028');
    expect(JSON.parse(json).features[0].id).toBe('</script>\u2028');
  });

  it('wraps a command in a script for the WebView that returns true', () => {
    const script = commandScript({ type: 'highlight', cui: null });
    expect(script).toBe('window.fiscusMap && window.fiscusMap.receive({"type":"highlight","cui":null});true;');
  });
});
