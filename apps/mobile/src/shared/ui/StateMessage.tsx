import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouch, rule, space } from '../theme/tokens';
import { BodyText, DisplayText } from './typography';

type Props =
  | { kind: 'loading'; message?: string }
  | { kind: 'empty'; message: string }
  | { kind: 'error'; message?: string; onRetry?: () => void };

/** Loading, empty and error states. Direct copy, no apologies. */
export function StateMessage(props: Props) {
  if (props.kind === 'loading') {
    return (
      <View style={styles.box} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.ink} />
        <BodyText muted>{props.message ?? 'Cargando…'}</BodyText>
      </View>
    );
  }
  if (props.kind === 'empty') {
    return (
      <View style={styles.box}>
        <BodyText muted>{props.message}</BodyText>
      </View>
    );
  }
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <BodyText weight={600}>{props.message ?? 'No se pudieron cargar los datos.'}</BodyText>
      {props.onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
          onPress={props.onRetry}
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}>
          <DisplayText size={18}>Reintentar</DisplayText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    gap: space.md,
    alignItems: 'flex-start',
  },
  retry: {
    minHeight: minTouch,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderWidth: rule,
    borderColor: colors.ink,
    backgroundColor: colors.signal,
  },
  retryPressed: { backgroundColor: colors.signalPressed },
});
