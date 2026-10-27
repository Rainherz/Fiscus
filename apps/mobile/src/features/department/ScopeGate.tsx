import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/shared/theme/tokens';
import { AppHeader } from '@/shared/ui/AppHeader';
import { StateMessage } from '@/shared/ui/StateMessage';

import { useScope } from './ScopeContext';

/**
 * Holds the screens back until the last chosen scope was read from the device, so nothing fetches
 * or shows data for the wrong scope. Meanwhile it shows the header with a placeholder selector.
 */
export function ScopeGate({ children }: { children: ReactNode }) {
  const { ready } = useScope();
  const insets = useSafeAreaInsets();
  if (ready) return children;
  return (
    <View style={styles.screen}>
      <AppHeader scopeLabel={null} levelLabel={null} onPressScope={() => {}} topInset={insets.top} />
      <StateMessage kind="loading" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
});
