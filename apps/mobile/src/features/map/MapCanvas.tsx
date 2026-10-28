import { useCallback, useRef, type ComponentType, type RefAttributes } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';

import { colors } from '@/shared/theme/tokens';

import { commandScript, type MapCommand } from './mapBridge';
import { useMapSync, type MapSyncProps } from './useMapSync';

export interface MapCanvasProps extends MapSyncProps {
  /** The page from buildMapHtml. A new string reloads the map. */
  html: string;
  accessibilityLabel: string;
}

interface WebViewHandle {
  injectJavaScript: (script: string) => void;
}

/** The library's class type defaults its extra props to `undefined`, which makes every JSX prop `never`. */
const MapWebView = WebView as unknown as ComponentType<WebViewProps & RefAttributes<WebViewHandle>>;

const isWebLink = (url: string) => /^https?:\/\//.test(url);

/** iOS/Android: the shared map page in a WebView (react-native-webview ships with Expo Go). */
export function MapCanvas({ html, accessibilityLabel, ...sync }: MapCanvasProps) {
  const webView = useRef<WebViewHandle>(null);
  const send = useCallback((command: MapCommand) => webView.current?.injectJavaScript(commandScript(command)), []);
  const receive = useMapSync(sync, send);

  return (
    <View style={styles.map} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <MapWebView
        ref={webView}
        source={{ html }}
        originWhitelist={['*']}
        onMessage={(event) => receive(event.nativeEvent.data)}
        // Attribution links open in the browser instead of replacing the map.
        onShouldStartLoadWithRequest={(request) => {
          if (request.isTopFrame === false || !isWebLink(request.url)) return true;
          Linking.openURL(request.url);
          return false;
        }}
        onOpenWindow={(event) => {
          if (isWebLink(event.nativeEvent.targetUrl)) Linking.openURL(event.nativeEvent.targetUrl);
        }}
        setSupportMultipleWindows={false}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: colors.concrete },
  web: { flex: 1, backgroundColor: colors.concrete },
});
