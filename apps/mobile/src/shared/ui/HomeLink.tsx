import { Pressable, StyleSheet } from 'react-native';

import { useGoHome, type HomeOrigin } from '../navigation/goHome';
import { colors, minTouch } from '../theme/tokens';
import { DisplayText } from './typography';

export const HOME_LINK_LABEL = 'Fiscus, ir al inicio';

/** The "FISCUS" mark in signal yellow: a link back to Inicio from every screen. */
export function HomeLink({ size, origin }: { size: number; origin: HomeOrigin }) {
  const goHome = useGoHome(origin);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={HOME_LINK_LABEL}
      hitSlop={8}
      onPress={goHome}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <DisplayText weight={900} size={size} style={styles.brand}>
        FISCUS
      </DisplayText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: minTouch, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  brand: { color: colors.signal, letterSpacing: 1 },
});
