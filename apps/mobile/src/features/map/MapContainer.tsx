import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReadScope, useScope } from '@/features/department/ScopeContext';
import { useInvestment, useMapPoints } from '@/features/investments/hooks/queries';
import { MAX_MAP_POINTS, toMapPoint, type BBox, type MapPoint } from '@/features/investments/domain/mapPoints';
import { useDebouncedValue } from '@/features/search/useDebouncedValue';
import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { colors } from '@/shared/theme/tokens';
import { BackHeader } from '@/shared/ui/BackHeader';
import { StateMessage } from '@/shared/ui/StateMessage';

import { LeafletMap } from './LeafletMap';
import type { MapEvent } from './mapBridge';
import { buildMapHtml } from './mapHtml';
import { toMapFeatures } from './mapPresentation';
import { initialMapView, toMapPointsRequest } from './mapRequest';
import { MapScreenView, type MapStatus } from './MapScreenView';

/** CARTO basemaps key (public by design: it ships in the app); without it tiles are watermarked. */
const CARTO_BASEMAPS_KEY = process.env.EXPO_PUBLIC_CARTO_BASEMAPS_KEY || undefined;

/** Wait this long after the map stops moving before asking for its projects. */
const MOVE_DEBOUNCE_MS = 300;

export const MAP_ACCESSIBILITY_LABEL =
  'Mapa de proyectos con coordenadas. Es información complementaria: la misma información está en Rankings, enlace Ver como lista.';

function useBack() {
  const router = useRouter();
  return () => {
    blurActiveElement();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
}

/**
 * "Mapa" (`/map`, or `/map?cui=…` from a project's detail: centered on it, card open). Follows the
 * app's scope (department bounds or all of Peru) and level.
 */
export function MapContainer() {
  const insets = useSafeAreaInsets();
  const onBack = useBack();
  const { cui } = useLocalSearchParams<{ cui?: string }>();
  const focus = useInvestment(cui ?? '', { enabled: Boolean(cui) });

  if (cui && focus.status === 'pending') {
    return (
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        <BackHeader title="MAPA" topInset={insets.top} onBack={onBack} />
        <StateMessage kind="loading" />
      </View>
    );
  }
  const focusPoint = cui && focus.data ? toMapPoint(focus.data) : null;
  return <MapScreen focus={focusPoint} />;
}

function MapScreen({ focus }: { focus: MapPoint | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const onBack = useBack();
  const { label, levelLabel } = useScope();
  const read = useReadScope();
  // The page is built once: a new string would reload the WebView. The scope cannot change here.
  const [html] = useState(() =>
    buildMapHtml(initialMapView({ departmentCode: read.departmentCode, focus }), { tilesKey: CARTO_BASEMAPS_KEY }),
  );

  const [view, setView] = useState<{ bbox: BBox; zoom: number } | null>(null);
  const settled = useDebouncedValue(view, MOVE_DEBOUNCE_MS);
  const request = useMemo(() => (settled ? toMapPointsRequest(settled, read) : null), [settled, read]);
  const query = useMapPoints(request);
  const features = useMemo(() => (query.data ? toMapFeatures(query.data) : []), [query.data]);

  const [selected, setSelected] = useState<MapPoint | null>(focus);
  const [mapFailed, setMapFailed] = useState(false);

  const onEvent = (event: MapEvent) => {
    switch (event.type) {
      case 'moved':
        setView({ bbox: event.bbox, zoom: event.zoom });
        return;
      case 'pointPressed': {
        const point = query.data?.kind === 'points' ? query.data.points.find((p) => p.cui === event.cui) : undefined;
        if (point) setSelected(point);
        return;
      }
      case 'mapPressed':
        setSelected(null);
        return;
      case 'loadFailed':
        setMapFailed(true);
        return;
      case 'ready':
        return;
    }
  };

  const status: MapStatus = mapFailed
    ? { kind: 'mapFailed' }
    : query.isError
      ? { kind: 'error' }
      : query.isFetching || view !== settled
        ? { kind: 'loading' }
        : query.data?.kind === 'points' && query.data.points.length === 0
          ? { kind: 'empty' }
          : query.data?.kind === 'points' && query.data.points.length >= MAX_MAP_POINTS
            ? { kind: 'truncated', shown: query.data.points.length }
            : { kind: 'idle' };

  return (
    <MapScreenView
      scopeLine={`${label} · ${levelLabel}`}
      status={status}
      map={
        <LeafletMap
          html={html}
          features={features}
          highlightCui={selected?.cui ?? null}
          onEvent={onEvent}
          accessibilityLabel={MAP_ACCESSIBILITY_LABEL}
        />
      }
      selected={selected}
      onRetry={() => query.refetch()}
      onPressDetail={(cui) => {
        blurActiveElement();
        router.push({ pathname: '/investment/[cui]', params: { cui } });
      }}
      onCloseCard={() => setSelected(null)}
      onPressList={() => {
        blurActiveElement();
        router.navigate({ pathname: '/rankings', params: { tab: 'increase-amount' } });
      }}
      onBack={onBack}
      topInset={insets.top}
      bottomInset={insets.bottom}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
});
