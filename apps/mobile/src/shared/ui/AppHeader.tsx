import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { gutterFor, isWide, LAYOUT_MAX_WIDTH } from '../layout/breakpoints';
import { useBreakpoint } from '../layout/useBreakpoint';
import { colors, minTouch, space } from '../theme/tokens';
import { HeaderAccessory } from './HeaderAccessory';
import { HomeLink } from './HomeLink';
import { MonoText } from './typography';

interface Props {
  /** "Todo el Perú" or a department name; null while the last choice is being read. */
  scopeLabel: string | null;
  /** "Todos los niveles" or one level; null while the last choice is being read. */
  levelLabel: string | null;
  onPressScope: () => void;
  /** Safe-area top inset, supplied by the container. */
  topInset?: number;
  /** The main sections (tablet and desktop), shown next to the brand. */
  nav?: ReactNode;
}

/**
 * Black bar: brand in signal yellow (a link to Inicio) and the scope selector trigger, which shows
 * the region and, on a second line, the government level. Both are chosen in the region picker.
 * On tablet and desktop the bar spans the window, its content follows the page column and the
 * main sections sit next to the brand. The header accessory (stale-data banner) follows the bar.
 */
export function AppHeader({ scopeLabel, levelLabel, onPressScope, topInset = 0, nav }: Props) {
  const breakpoint = useBreakpoint();
  const wide = isWide(breakpoint);
  const selector =
    scopeLabel === null || levelLabel === null ? (
      <View style={styles.selector} accessible accessibilityLabel="Cargando región">
        <View style={styles.placeholder} />
      </View>
    ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Cambiar región o nivel de gobierno. Región actual: ${scopeLabel}. Nivel: ${levelLabel}`}
        hitSlop={8}
        onPress={onPressScope}
        style={({ pressed }) => [styles.selector, pressed && styles.pressed]}>
        <MonoText size={12} style={styles.selectorText}>
          {`${scopeLabel.toUpperCase()} ▾`}
        </MonoText>
        <MonoText size={10} style={styles.levelText}>
          {levelLabel.toUpperCase()}
        </MonoText>
      </Pressable>
    );

  if (!wide) {
    return (
      <>
        <View style={[styles.bar, styles.row, styles.phone, { paddingTop: topInset + 12 }]}>
          <HomeLink size={30} origin="tab" />
          {selector}
        </View>
        <HeaderAccessory />
      </>
    );
  }

  return (
    <>
      <View role="banner" style={[styles.bar, { paddingTop: topInset + 12 }]}>
        <View style={[styles.row, styles.column, { paddingHorizontal: gutterFor(breakpoint) }]}>
          <View style={styles.start}>
            <HomeLink size={30} origin="tab" />
            {nav}
          </View>
          {selector}
        </View>
      </View>
      <HeaderAccessory />
    </>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.ink, paddingBottom: 12 },
  phone: { paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  /** Wide screens: the content follows the page column. */
  column: { width: '100%', maxWidth: LAYOUT_MAX_WIDTH, alignSelf: 'center' },
  start: { flexDirection: 'row', alignItems: 'center', gap: space.xl, flexShrink: 1 },
  selector: {
    minHeight: minTouch,
    paddingHorizontal: space.xs,
    justifyContent: 'center',
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  pressed: { opacity: 0.7 },
  selectorText: { color: colors.concrete, textAlign: 'right' },
  /** Second line: quieter than the region, still legible on ink. */
  levelText: { color: colors.signal, textAlign: 'right', marginTop: 2 },
  /** Bar the size of a short label, in a muted tone of the selector text. */
  placeholder: { width: 96, height: 12, backgroundColor: colors.muted },
});
