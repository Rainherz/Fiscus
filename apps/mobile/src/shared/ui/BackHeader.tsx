import { Pressable, StyleSheet, View } from 'react-native';

import { gutterFor, isWide, LAYOUT_MAX_WIDTH } from '../layout/breakpoints';
import { useBreakpoint } from '../layout/useBreakpoint';
import { colors, minTouch, space } from '../theme/tokens';
import { HeaderAccessory } from './HeaderAccessory';
import { HomeLink } from './HomeLink';
import { DisplayText, MonoText } from './typography';

interface Props {
  onBack: () => void;
  title?: string;
  topInset?: number;
}

/**
 * Black bar for pushed screens: back action, an optional title after it and the "FISCUS" link to
 * Inicio on the right. On tablet and desktop its content follows the page column. The header
 * accessory (stale-data banner) follows the bar.
 */
export function BackHeader({ onBack, title, topInset = 0 }: Props) {
  const breakpoint = useBreakpoint();
  const wide = isWide(breakpoint);
  return (
    <>
      <View style={[styles.bar, { paddingTop: topInset + 8 }]}>
        <View
          style={[
            styles.row,
            wide ? [styles.column, { paddingHorizontal: gutterFor(breakpoint) }] : styles.phone,
          ]}>
          <View style={styles.start}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver"
              onPress={onBack}
              hitSlop={8}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
              <MonoText bold size={13} style={styles.backText}>
                ← VOLVER
              </MonoText>
            </Pressable>
            {title ? (
              <DisplayText size={18} numberOfLines={1} accessibilityRole="header" style={styles.title}>
                {title}
              </DisplayText>
            ) : null}
          </View>
          <HomeLink size={22} origin="stack" />
        </View>
      </View>
      <HeaderAccessory />
    </>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.ink, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  phone: { paddingHorizontal: space.lg },
  column: { width: '100%', maxWidth: LAYOUT_MAX_WIDTH, alignSelf: 'center' },
  start: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexShrink: 1 },
  back: { minHeight: minTouch, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  backText: { color: colors.concrete },
  title: { color: colors.signal, flexShrink: 1 },
});
