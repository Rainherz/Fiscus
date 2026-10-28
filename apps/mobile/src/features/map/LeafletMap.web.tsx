import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/shared/theme/tokens';

import { serializeCommand, type MapCommand } from './mapBridge';
import type { LeafletMapProps } from './LeafletMap';
import { useMapSync } from './useMapSync';

/**
 * Web: the same Leaflet page in a sandboxed iframe (scripts only, no same-origin access).
 * Messages travel with postMessage; only those from this iframe are read.
 */
export function LeafletMap({ html, accessibilityLabel, ...sync }: LeafletMapProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const send = useCallback(
    (command: MapCommand) => frame.current?.contentWindow?.postMessage(serializeCommand(command), '*'),
    [],
  );
  const receive = useMapSync(sync, send);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (frame.current && event.source === frame.current.contentWindow) receive(event.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [receive]);

  return (
    <View style={styles.map}>
      <iframe
        ref={frame}
        srcDoc={html}
        title={accessibilityLabel}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: colors.concrete },
});
