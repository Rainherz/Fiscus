import { Pressable, StyleSheet, View } from 'react-native';

import { formatDateTime } from '@/shared/format';
import { gutterFor, isWide, LAYOUT_MAX_WIDTH } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { BodyText, MonoText } from '@/shared/ui/typography';

interface Props {
  /** The last successful SSI update. */
  lastUpdatedAt: string;
  onDismiss: () => void;
}

/**
 * Non-blocking notice under the header: ink on signal yellow over a 2px rule. On tablet and
 * desktop the strip spans the window and its content follows the page column.
 */
export function StaleDataBanner({ lastUpdatedAt, onDismiss }: Props) {
  const breakpoint = useBreakpoint();
  const wide = isWide(breakpoint);
  return (
    <View testID="stale-banner" role="status" style={styles.banner}>
      <View
        style={[styles.row, wide ? [styles.column, { paddingHorizontal: gutterFor(breakpoint) }] : styles.phone]}>
        <BodyText size={14} weight={600} style={styles.message}>
          {`Los datos podrían estar desactualizados. Última actualización: ${formatDateTime(lastUpdatedAt)}.`}
        </BodyText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ocultar aviso"
          hitSlop={8}
          onPress={onDismiss}
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
          <MonoText bold size={18} style={styles.dismissText}>
            ×
          </MonoText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.signal, borderBottomWidth: rule, borderBottomColor: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  phone: { paddingLeft: space.lg, paddingRight: space.sm },
  column: { width: '100%', maxWidth: LAYOUT_MAX_WIDTH, alignSelf: 'center' },
  message: { color: colors.ink, flex: 1, paddingVertical: space.xs },
  dismiss: { minWidth: minTouch, minHeight: minTouch, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.signalPressed },
  dismissText: { color: colors.ink },
});
