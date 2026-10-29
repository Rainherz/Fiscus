import { Pressable, StyleSheet, View } from 'react-native';

import { TermHint } from '@/features/glossary/TermHint';
import { levelTag } from '@/features/government-level/levelPresentation';
import { hasValidIncrease, type MapListItem, type MapPoint } from '@/features/investments/domain/mapPoints';
import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { LevelTag } from '@/shared/ui/LevelTag';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import { pointCardFactTerms, pointCardFacts, pointCardFigure, pointCardFigureTerm } from './mapPresentation';

interface Props {
  point: MapPoint;
  /** The rest of the figures: from the list row, or read by CUI after a tap on the map. */
  details: MapListItem | null;
  detailsStatus: 'loading' | 'ready' | 'error';
  onPressDetail: () => void;
  onClose: () => void;
}

/** The selected project (outside the WebView, so it is native and accessible). */
export function MapPointCard({ point, details, detailsStatus, onPressDetail, onClose }: Props) {
  const name = point.name ?? 'Sin nombre';
  const tag = levelTag(point.governmentLevel);
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.top}>
        <View style={styles.identity}>
          {tag ? <LevelTag tag={tag} /> : null}
          <MonoText bold size={11} muted>{`CUI ${point.cui}`}</MonoText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <MonoText bold size={16}>
            ×
          </MonoText>
        </Pressable>
      </View>
      <DisplayText size={20} numberOfLines={2} style={styles.name}>
        {name}
      </DisplayText>
      {details?.entity ? (
        <MonoText size={11} muted numberOfLines={1}>
          {details.entity}
        </MonoText>
      ) : null}
      <View style={styles.line}>
        <MonoText bold size={14} style={hasValidIncrease(point) ? styles.increase : undefined}>
          {pointCardFigure(point)}
        </MonoText>
        <TermHint term={pointCardFigureTerm(point)} />
      </View>
      {details ? (
        <View style={styles.facts}>
          {pointCardFacts(details).map((fact, index) => {
            const term = pointCardFactTerms(details)[index];
            return (
              <View key={fact} style={styles.line}>
                <MonoText bold size={12} style={fact.startsWith('Sin gasto') ? styles.stalled : undefined}>
                  {fact}
                </MonoText>
                {term ? <TermHint term={term} /> : null}
              </View>
            );
          })}
        </View>
      ) : detailsStatus === 'loading' ? (
        <MonoText size={11} muted>
          Cargando datos del proyecto…
        </MonoText>
      ) : detailsStatus === 'error' ? (
        <MonoText size={11} muted>
          No se pudieron cargar los demás datos del proyecto.
        </MonoText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver detalle: ${name}`}
        onPress={onPressDetail}
        style={({ pressed }) => [styles.detail, pressed && styles.detailPressed]}>
        <DisplayText size={18}>Ver detalle →</DisplayText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.concrete,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.xs,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  close: { minWidth: minTouch, minHeight: minTouch - 8, alignItems: 'flex-end', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  name: { lineHeight: 21 },
  increase: { alignSelf: 'flex-start', backgroundColor: colors.signal, paddingHorizontal: space.xs },
  facts: { gap: space.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stalled: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.ink, paddingHorizontal: space.xs },
  detail: {
    minHeight: minTouch,
    justifyContent: 'center',
    borderTopWidth: rule,
    borderTopColor: colors.ink,
    marginTop: space.xs,
  },
  detailPressed: { backgroundColor: colors.concretePressed },
});
