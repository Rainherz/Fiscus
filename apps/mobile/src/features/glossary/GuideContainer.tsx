import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { colors } from '@/shared/theme/tokens';
import { BackHeader } from '@/shared/ui/BackHeader';

import { GuideView } from './GuideView';

/** "/guia": opened from the footer, Inicio (phone), the header (desktop) and every term hint. */
export function GuideContainer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const back = () => {
    blurActiveElement();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <BackHeader title="GUÍA" topInset={insets.top} onBack={back} />
      <GuideView />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
});
