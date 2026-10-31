import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouch, rule, space } from '../theme/tokens';
import { BodyText, MonoText } from './typography';

export interface EmptyStateAction {
  key: string;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}

interface Props {
  /** What is missing, with the filters that are on. */
  message: string;
  /** A fact that explains the empty list, when there is one. */
  hint?: string | null;
  /** Shortcuts that relax the filters (at most two). */
  actions?: readonly EmptyStateAction[];
  /** "plain": a list's empty state; "ruled": a home block, between two ink rules. */
  variant?: 'plain' | 'ruled';
}

/** An empty list: what is missing, why, and how to see more. */
export function EmptyState({ message, hint, actions = [], variant = 'plain' }: Props) {
  const ruled = variant === 'ruled';
  return (
    <View testID="empty-state" style={ruled ? styles.ruled : styles.plain}>
      {ruled ? <MonoText size={12}>{message}</MonoText> : <BodyText muted>{message}</BodyText>}
      {hint ? (
        <MonoText size={11} muted>
          {hint}
        </MonoText>
      ) : null}
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
              onPress={action.onPress}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
              <MonoText bold size={12}>
                {action.label.toUpperCase()}
              </MonoText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plain: {
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    gap: space.md,
    alignItems: 'flex-start',
  },
  ruled: {
    borderTopWidth: rule,
    borderTopColor: colors.ink,
    borderBottomWidth: rule,
    borderBottomColor: colors.ink,
    paddingVertical: space.md,
    gap: space.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  action: {
    minHeight: minTouch,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderWidth: rule,
    borderColor: colors.ink,
  },
  actionPressed: { backgroundColor: colors.concretePressed },
});
