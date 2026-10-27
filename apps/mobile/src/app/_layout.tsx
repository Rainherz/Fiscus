import {
  BigShouldersDisplay_800ExtraBold,
  BigShouldersDisplay_900Black,
} from '@expo-google-fonts/big-shoulders-display';
import {
  InterTight_400Regular,
  InterTight_600SemiBold,
  InterTight_700Bold,
} from '@expo-google-fonts/inter-tight';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DepartmentProvider } from '@/features/department/DepartmentContext';
import { createRepository } from '@/features/investments/createRepository';
import { dataSourceFromEnv } from '@/features/investments/dataSource';
import { RepositoryProvider } from '@/features/investments/RepositoryContext';
import { colors } from '@/shared/theme/tokens';
import { StateMessage } from '@/shared/ui/StateMessage';

SplashScreen.preventAutoHideAsync();

const dataSource = dataSourceFromEnv();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BigShouldersDisplay_800ExtraBold,
    BigShouldersDisplay_900Black,
    InterTight_400Regular,
    InterTight_600SemiBold,
    InterTight_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } } }),
  );
  const [repository] = useState(() =>
    dataSource.kind === 'missing-config' ? null : createRepository(dataSource),
  );

  const ready = fontsLoaded || fontError !== null;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  if (!repository) {
    return (
      <View style={styles.screen}>
        <StateMessage
          kind="error"
          message="Falta configurar la conexión a los datos: EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (ver apps/mobile/.env.example)."
        />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repository={repository} isDemo={dataSource.kind === 'mock'}>
        <DepartmentProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.concrete },
            }}>
            {/* The region picker covers the whole screen and slides up over the screen it was opened from. */}
            <Stack.Screen name="region" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
        </DepartmentProvider>
      </RepositoryProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', backgroundColor: colors.concrete },
});
