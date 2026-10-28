import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { MapPoint } from '@/features/investments/domain/mapPoints';
import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { BackHeader } from '@/shared/ui/BackHeader';
import { BodyText, DisplayText, MonoText } from '@/shared/ui/typography';

import { MapPointCard } from './MapPointCard';

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
  /** "Arequipa · Todos los niveles". */
  scopeLine: string;
  status: MapStatus;
  /** The LeafletMap element. */
  map: ReactNode;
  selected: MapPoint | null;
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

/** "Mapa": the projects with coordinates of the scope, as clusters or points, and the tapped one. */
export function MapScreenView({
  scopeLine,
  status,
  map,
  selected,
  onRetry,
  onPressDetail,
  onCloseCard,
  onPressList,
  onBack,
  topInset = 0,
  bottomInset = 0,
}: Props) {
  return (
    <View style={[styles.screen, { paddingBottom: bottomInset }]}>
      <BackHeader title="MAPA" topInset={topInset} onBack={onBack} />
      <View style={styles.scope}>
        <MonoText bold size={12}>
          {scopeLine.toUpperCase()}
        </MonoText>
      </View>
      <StatusLine status={status} onRetry={onRetry} />
      <View style={styles.map}>{map}</View>
      {selected ? (
        <MapPointCard point={selected} onPressDetail={() => onPressDetail(selected.cui)} onClose={onCloseCard} />
      ) : null}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  flex: { flex: 1 },
  scope: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: rule,
    borderBottomColor: colors.ink,
  },
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
