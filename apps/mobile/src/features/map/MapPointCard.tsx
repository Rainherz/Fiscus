import { Pressable, StyleSheet, View } from 'react-native';

import { levelTag } from '@/features/government-level/levelPresentation';
import { hasValidIncrease, type MapPoint } from '@/features/investments/domain/mapPoints';
import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { LevelTag } from '@/shared/ui/LevelTag';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import { pointCardFigure } from './mapPresentation';

interface Props {
  point: MapPoint;
  onPressDetail: () => void;
  onClose: () => void;
}

/** The tapped project, under the map (outside the WebView, so it is native and accessible). */
export function MapPointCard({ point, onPressDetail, onClose }: Props) {
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
      <MonoText bold size={14} style={hasValidIncrease(point) ? styles.increase : undefined}>
        {pointCardFigure(point)}
      </MonoText>
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
    borderTopWidth: rule,
    borderTopColor: colors.ink,
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
  detail: {
    minHeight: minTouch,
    justifyContent: 'center',
    borderTopWidth: rule,
    borderTopColor: colors.ink,
    marginTop: space.xs,
  },
  detailPressed: { backgroundColor: colors.concretePressed },
});
