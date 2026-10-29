import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, rule, space } from '@/shared/theme/tokens';
import { MonoText } from '@/shared/ui/typography';

/**
 * Same marks as the map page (mapHtml.ts): signal dot outlined in ink, ink dot, hollow ink ring
 * (closed project), ink cluster.
 */
const ITEMS = [
  { key: 'increased', label: 'Con aumento de costo' },
  { key: 'flat', label: 'Sin aumento' },
  { key: 'closed', label: 'Proyecto cerrado (círculo hueco)' },
  { key: 'cluster', label: 'Grupo de proyectos (toca para acercar)' },
] as const;

function Mark({ kind }: { kind: (typeof ITEMS)[number]['key'] }) {
  if (kind === 'cluster') {
    return (
      <View style={styles.cluster}>
        <MonoText bold size={8} style={styles.clusterText}>
          12
        </MonoText>
      </View>
    );
  }
  if (kind === 'closed') return <View style={styles.closed} />;
  return <View style={kind === 'increased' ? styles.increased : styles.flat} />;
}

/**
 * What the marks mean, fixed over the map (outside the map page, so it is native text). Phones can
 * collapse it to keep the map clear.
 */
export function MapLegend({ collapsible }: { collapsible: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.box}>
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Ocultar leyenda' : 'Mostrar leyenda'}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((value) => !value)}
          hitSlop={8}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
          <MonoText bold size={10}>
            {open ? 'LEYENDA −' : 'LEYENDA +'}
          </MonoText>
        </Pressable>
      ) : null}
      {open ? (
        <View accessibilityRole="summary" accessibilityLabel="Leyenda del mapa" style={styles.items}>
          {ITEMS.map((entry) => (
            <View key={entry.key} style={styles.item}>
              <View style={styles.markSlot}>
                <Mark kind={entry.key} />
              </View>
              <MonoText size={10}>{entry.label}</MonoText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'flex-end',
    margin: space.sm,
    backgroundColor: colors.concrete,
    borderWidth: rule,
    borderColor: colors.ink,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    maxWidth: 230,
  },
  toggle: { minHeight: 24, justifyContent: 'center', alignSelf: 'flex-end' },
  pressed: { opacity: 0.6 },
  items: { gap: 3, paddingVertical: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  markSlot: { width: 18, alignItems: 'center' },
  increased: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.signal,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  flat: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  closed: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.ink },
  cluster: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterText: { color: colors.signal, lineHeight: 10 },
});
