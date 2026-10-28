import { useCallback, useEffect, useRef } from 'react';

import { parseMapEvent, type MapCommand, type MapEvent, type MapFeature } from './mapBridge';

export interface MapSyncProps {
  features: MapFeature[];
  highlightCui: string | null;
  onEvent: (event: MapEvent) => void;
}

/**
 * Keeps the Leaflet page in step with the props, whatever carries the messages (WebView or
 * iframe). Nothing is sent before the page says it is ready; a reloaded page gets everything
 * again. Returns the handler for raw messages from the page.
 */
export function useMapSync({ features, highlightCui, onEvent }: MapSyncProps, send: (command: MapCommand) => void) {
  const ready = useRef(false);
  const latest = useRef({ features, highlightCui, onEvent, send });
  latest.current = { features, highlightCui, onEvent, send };

  useEffect(() => {
    if (ready.current) latest.current.send({ type: 'setData', features });
  }, [features]);

  useEffect(() => {
    if (ready.current) latest.current.send({ type: 'highlight', cui: highlightCui });
  }, [highlightCui]);

  return useCallback((raw: unknown) => {
    const event = parseMapEvent(raw);
    if (!event) return;
    const current = latest.current;
    if (event.type === 'ready') {
      ready.current = true;
      current.send({ type: 'setData', features: current.features });
      current.send({ type: 'highlight', cui: current.highlightCui });
    }
    current.onEvent(event);
  }, []);
}
