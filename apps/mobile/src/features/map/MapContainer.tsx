import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReadScope, useScope } from '@/features/department/ScopeContext';
import {
  MAX_MAP_POINTS,
  toMapListItem,
  type BBox,
  type MapListItem,
  type MapListPage,
  type MapPoint,
} from '@/features/investments/domain/mapPoints';
import { useAccrualReferenceMonth, useInvestment, useMapList, useMapPoints } from '@/features/investments/hooks/queries';
import { useDebouncedValue } from '@/features/search/useDebouncedValue';
import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { colors } from '@/shared/theme/tokens';
import { BackHeader } from '@/shared/ui/BackHeader';
import { StateMessage } from '@/shared/ui/StateMessage';

import { MapCanvas } from './MapCanvas';
import type { MapEvent } from './mapBridge';
import { MapControls } from './MapControls';
import { parseMapFilters, serializeMapFilters, toggleMapFilter } from './mapFilters';
import { buildMapHtml } from './mapHtml';
import { toMapFeatures, withSelected } from './mapPresentation';
import type { MapListState } from './MapProjectList';
import { initialMapView, toMapListRequest, toMapPointsRequest } from './mapRequest';
import { MapScreenView, type MapSelection, type MapStatus } from './MapScreenView';

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
 * "Mapa" (`/map`, `/map?f=increase,stalled` with filters, or `/map?cui=…` from a project's detail:
 * centered on it, card open). Follows the app's scope (department bounds or all of Peru) and level.
 */
export function MapContainer() {
  const insets = useSafeAreaInsets();
  const onBack = useBack();
  const { cui } = useLocalSearchParams<{ cui?: string }>();
  const focus = useInvestment(cui ?? '', { enabled: Boolean(cui) });
  const referenceMonth = useAccrualReferenceMonth();
  const { departmentCode } = useReadScope();
  // The focus belongs to the scope the map was opened in: a new region from the picker frames the
  // region instead.
  const [openedIn] = useState(departmentCode);

  if (cui && (focus.status === 'pending' || referenceMonth.status === 'pending')) {
    return (
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        <BackHeader title="MAPA" topInset={insets.top} onBack={onBack} />
        <StateMessage kind="loading" />
      </View>
    );
  }
  const focusItem =
    cui && focus.data && departmentCode === openedIn ? toMapListItem(focus.data, referenceMonth.data ?? null) : null;
  // The page is built once per scope (a new string reloads the WebView), so a new region remounts it.
  return <MapScreen key={departmentCode ?? 'all'} focus={focusItem} />;
}

function MapScreen({ focus }: { focus: MapListItem | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const onBack = useBack();
  const { label, level, setLevel } = useScope();
  const read = useReadScope();
  const params = useLocalSearchParams<{ f?: string | string[] }>();
  const filters = useMemo(() => parseMapFilters(params.f), [params.f]);
  const [html] = useState(() => buildMapHtml(initialMapView({ departmentCode: read.departmentCode, focus })));

  const [view, setView] = useState<{ bbox: BBox; zoom: number } | null>(null);
  const settled = useDebouncedValue(view, MOVE_DEBOUNCE_MS);
  const request = useMemo(() => (settled ? toMapPointsRequest(settled, read, filters) : null), [settled, read, filters]);
  const listRequest = useMemo(() => (settled ? toMapListRequest(settled, read, filters) : null), [settled, read, filters]);
  const query = useMapPoints(request);
  const listQuery = useMapList(listRequest);

  const [selected, setSelected] = useState<{ point: MapPoint; details: MapListItem | null } | null>(
    focus ? { point: focus, details: focus } : null,
  );
  // A project tapped on the map comes without its figures: read them by CUI.
  const needsDetails = selected !== null && selected.details === null;
  const detailsQuery = useInvestment(selected?.point.cui ?? '', { enabled: needsDetails });
  const referenceMonth = useAccrualReferenceMonth();
  const [mapFailed, setMapFailed] = useState(false);

  const features = useMemo(
    () => withSelected(query.data ? toMapFeatures(query.data) : [], selected?.point ?? null),
    [query.data, selected],
  );

  const onEvent = (event: MapEvent) => {
    switch (event.type) {
      case 'moved':
        setView({ bbox: event.bbox, zoom: event.zoom });
        return;
      case 'pointPressed': {
        const point = query.data?.kind === 'points' ? query.data.points.find((p) => p.cui === event.cui) : undefined;
        const listed = listItems(listQuery.data).find((item) => item.cui === event.cui);
        if (listed) setSelected({ point: listed, details: listed });
        else if (point) setSelected({ point, details: null });
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

  const moving = view !== settled;
  const status: MapStatus = mapFailed
    ? { kind: 'mapFailed' }
    : query.isError
      ? { kind: 'error' }
      : query.isFetching || moving
        ? { kind: 'loading' }
        : query.data?.kind === 'points' && query.data.points.length === 0
          ? { kind: 'empty' }
          : query.data?.kind === 'points' && query.data.points.length >= MAX_MAP_POINTS
            ? { kind: 'truncated', shown: query.data.points.length }
            : { kind: 'idle' };

  const list: MapListState =
    listQuery.isError && !listQuery.data
      ? { kind: 'error' }
      : !listQuery.data || (listQuery.isPlaceholderData && listQuery.isFetching)
        ? { kind: 'loading' }
        : {
            kind: 'ready',
            items: listItems(listQuery.data),
            total: listQuery.data.pages[0]?.total ?? 0,
            hasMore: listQuery.hasNextPage,
            loadingMore: listQuery.isFetchingNextPage,
          };

  const fetchedDetails =
    needsDetails && detailsQuery.data ? toMapListItem(detailsQuery.data, referenceMonth.data ?? null) : null;
  const selection: MapSelection | null = selected
    ? {
        point: selected.point,
        details: selected.details ?? fetchedDetails,
        detailsStatus:
          selected.details || fetchedDetails ? 'ready' : detailsQuery.isError ? 'error' : 'loading',
      }
    : null;

  return (
    <MapScreenView
      controls={
        <MapControls
          scopeLabel={label}
          level={level}
          filters={filters}
          onPressScope={() => {
            blurActiveElement();
            router.push('/region');
          }}
          onSelectLevel={setLevel}
          onToggleFilter={(key) => router.setParams({ f: serializeMapFilters(toggleMapFilter(filters, key)) })}
        />
      }
      status={status}
      map={
        <MapCanvas
          html={html}
          features={features}
          highlightCui={selected?.point.cui ?? null}
          onEvent={onEvent}
          accessibilityLabel={MAP_ACCESSIBILITY_LABEL}
        />
      }
      list={list}
      filtered={filters.length > 0}
      selected={selection}
      onPressItem={(item) => setSelected({ point: item, details: item })}
      onLoadMore={() => {
        if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) listQuery.fetchNextPage();
      }}
      onRetryList={() => listQuery.refetch()}
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

const listItems = (data: { pages: MapListPage[] } | undefined): MapListItem[] => data?.pages.flatMap((page) => page.items) ?? [];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
});
