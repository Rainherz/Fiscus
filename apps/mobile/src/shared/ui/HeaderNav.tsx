import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouch, rule, space } from '../theme/tokens';
import { DisplayText } from './typography';

interface Item<K extends string> {
  name: K;
  title: string;
}

interface Props<K extends string> {
  items: readonly Item<K>[];
  active: string;
  onSelect: (name: K) => void;
}

/**
 * The main sections as a horizontal navigation in the header (tablet and desktop): concrete
 * labels on ink, the current section in signal yellow over a signal rule.
 */
export function HeaderNav<K extends string>({ items, active, onSelect }: Props<K>) {
  return (
    <View role="navigation" accessibilityLabel="Secciones" style={styles.nav}>
      {items.map((item) => {
        const current = item.name === active;
        return (
          <Pressable
            key={item.name}
            accessibilityRole="link"
            accessibilityLabel={item.title}
            accessibilityState={{ selected: current }}
            aria-current={current ? 'page' : undefined}
            onPress={() => onSelect(item.name)}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.item,
              current && styles.current,
              (pressed || hovered) && !current && styles.hovered,
            ]}>
            <DisplayText size={18} style={{ color: current ? colors.signal : colors.concrete }}>
              {item.title}
            </DisplayText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'stretch', gap: space.xs },
  item: {
    minHeight: minTouch,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderBottomWidth: rule,
    borderBottomColor: 'transparent',
  },
  current: { borderBottomColor: colors.signal },
  hovered: { borderBottomColor: colors.concrete },
});
