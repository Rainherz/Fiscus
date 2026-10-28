import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import type { MapListItem, MapPoint } from '@/features/investments/domain/mapPoints';
import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { BackHeader } from '@/shared/ui/BackHeader';
import { BodyText, DisplayText, MonoText } from '@/shared/ui/typography';

import { MAP_WIDE_MIN_WIDTH } from './MapControls';
import { MapLegend } from './MapLegend';
import { MapPointCard } from './MapPointCard';
import { mapListCountText } from './mapPresentation';
import { MapProjectList, type MapListState } from './MapProjectList';

/** What the strip above the map says about the current view. */
export type MapStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'mapFailed' }
  | { kind: 'empty' }
  /** The view holds more projects than the map shows at once. */
  | { kind: 'truncated'; shown: number };

export const COVERAGE_NOTE = 'Solo proyectos con coordenadas registradas en el MEF (≈77 %).';

interface Props {
  /** The MapControls element: scope, level and filters. */
  controls: ReactNode;
  status: MapStatus;
  /** The MapCanvas element. */
  map: ReactNode;
  list: MapListState;
  /** Some filter is on. */
  filtered: boolean;
  selected: MapSelection | null;
  onPressItem: (item: MapListItem) => void;
  onLoadMore: () => void;
  onRetryList: () => void;
  onRetry: () => void;
  onPressDetail: (cui: string) => void;
  onCloseCard: () => void;
  onPressList: () => void;
  onBack: () => void;
  topInset?: number;
  bottomInset?: number;
}

function StatusLine({ status, onRetry }: { status: MapStatus; onRetry: () => void }) {
  switch (status.kind) {
    case 'loading':
      return (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.ink} />
          <MonoText size={12}>Cargando…</MonoText>
        </View>
      );
    case 'error':
      return (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <BodyText weight={600} size={13} style={styles.flex}>
            No se pudieron cargar los proyectos del mapa.
          </BodyText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
            onPress={onRetry}
            style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}>
            <MonoText bold size={12}>
              REINTENTAR
            </MonoText>
          </Pressable>
        </View>
      );
    case 'mapFailed':
      return (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <BodyText weight={600} size={13}>
            No se pudo cargar el mapa. Revisa la conexión a internet.
          </BodyText>
        </View>
      );
    case 'empty':
      return (
        <View style={styles.status}>
          <MonoText size={12}>No hay proyectos con coordenadas en esta zona.</MonoText>
        </View>
      );
    case 'truncated':
      return (
        <View style={styles.status}>
          <MonoText size={12}>{`Se muestran ${status.shown} proyectos. Acerca el mapa para ver el resto.`}</MonoText>
        </View>
      );
    case 'idle':
      return null;
  }
}

/** The project shown in the card. */
export interface MapSelection {
  point: MapPoint;
  details: MapListItem | null;
  detailsStatus: 'loading' | 'ready' | 'error';
}

/** "Mapa": legend, filters, the projects of the scope as clusters or points, their list and the selected one. */
export function MapScreenView({
  controls,
  status,
  map,
  list,
  filtered,
  selected,
  onPressItem,
  onLoadMore,
  onRetryList,
  onRetry,
  onPressDetail,
  onCloseCard,
  onPressList,
  onBack,
  topInset = 0,
  bottomInset = 0,
}: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= MAP_WIDE_MIN_WIDTH;
  const [sheetOpen, setSheetOpen] = useState(false);

  const card = selected ? (
    <View style={styles.cardBox}>
      <MapPointCard
        point={selected.point}
        details={selected.details}
        detailsStatus={selected.detailsStatus}
        onPressDetail={() => onPressDetail(selected.point.cui)}
        onClose={onCloseCard}
      />
    </View>
  ) : null;

  const projectList = (onPress: (item: MapListItem) => void, showCount: boolean) => (
    <MapProjectList
      list={list}
      filtered={filtered}
      selectedCui={selected?.point.cui ?? null}
      showCount={showCount}
      onPressItem={onPress}
      onLoadMore={onLoadMore}
      onRetry={onRetryList}
    />
  );

  const mapArea = (sheet: ReactNode = null) => (
    <View style={styles.map}>
      {map}
      {/* Over the map, so its size (and view) does not change when the status does. */}
      <View style={styles.overlay} pointerEvents="box-none">
        <StatusLine status={status} onRetry={onRetry} />
        <MapLegend collapsible={!wide} />
      </View>
      {sheet}
    </View>
  );

  const countText = list.kind === 'ready' ? mapListCountText(list.total) : null;

  return (
    <View style={[styles.screen, { paddingBottom: bottomInset }]}>
      <BackHeader title="MAPA" topInset={topInset} onBack={onBack} />
      {controls}
      {wide ? (
        <View style={styles.row}>
          {mapArea()}
          <View testID="map-side-panel" style={styles.panel}>
            {card}
            <View style={styles.flex}>{projectList(onPressItem, true)}</View>
          </View>
        </View>
      ) : (
        <>
          {/* The open list covers the lower part of the map instead of shrinking it: a smaller map
              would report a smaller view and refresh the very list being opened. */}
          {mapArea(
            sheetOpen ? (
              <View style={styles.sheetPanel}>
                {projectList((item) => {
                  // Close the sheet so the map and the card of the project are visible.
                  setSheetOpen(false);
                  onPressItem(item);
                }, false)}
              </View>
            ) : null,
          )}
          {sheetOpen ? null : card}
          <View style={styles.sheet}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={countText ? `${sheetOpen ? 'Ocultar lista' : 'Ver lista'}: ${countText}` : sheetOpen ? 'Ocultar lista' : 'Ver lista'}
              accessibilityState={{ expanded: sheetOpen }}
              onPress={() => setSheetOpen((open) => !open)}
              style={({ pressed }) => [styles.sheetBar, pressed && styles.sheetBarPressed]}>
              <MonoText bold size={12} style={styles.flex}>
                {(countText ?? 'Proyectos en esta zona').toUpperCase()}
              </MonoText>
              <MonoText bold size={12}>
                {sheetOpen ? 'OCULTAR ▾' : 'VER LISTA ▴'}
              </MonoText>
            </Pressable>
          </View>
        </>
      )}
      <View style={styles.footer}>
        <MonoText size={11} muted style={styles.flex}>
          {COVERAGE_NOTE}
        </MonoText>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Ver como lista"
          onPress={onPressList}
          hitSlop={4}
          style={({ pressed }) => [styles.list, pressed && styles.listPressed]}>
          <DisplayText size={16}>Ver como lista →</DisplayText>
        </Pressable>
      </View>
    </View>
  );
}

const PANEL_WIDTH = 380;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  panel: { width: PANEL_WIDTH, borderLeftWidth: rule, borderLeftColor: colors.ink },
  cardBox: { borderTopWidth: rule, borderTopColor: colors.ink, borderBottomWidth: rule, borderBottomColor: colors.ink },
  sheet: { borderTopWidth: rule, borderTopColor: colors.ink },
  sheetPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
    backgroundColor: colors.concrete,
    borderTopWidth: rule,
    borderTopColor: colors.ink,
  },
  sheetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: minTouch,
    paddingHorizontal: space.lg,
    backgroundColor: colors.concrete,
  },
  sheetBarPressed: { backgroundColor: colors.concretePressed },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    minHeight: 32,
    backgroundColor: colors.signal,
    borderBottomWidth: rule,
    borderBottomColor: colors.ink,
  },
  retry: {
    minHeight: minTouch - 12,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderWidth: rule,
    borderColor: colors.ink,
    backgroundColor: colors.concrete,
  },
  retryPressed: { backgroundColor: colors.concretePressed },
  map: { flex: 1, minHeight: 200 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    borderTopWidth: rule,
    borderTopColor: colors.ink,
  },
  list: { minHeight: minTouch, justifyContent: 'center' },
  listPressed: { opacity: 0.6 },
});
