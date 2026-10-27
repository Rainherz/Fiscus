import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/shared/ui/AppHeader';

import { useScope } from './ScopeContext';

/** Container: app header whose selector opens the region picker screen (`/region`). */
export function RegionHeader() {
  const { label, ready } = useScope();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <AppHeader scopeLabel={ready ? label : null} onPressScope={() => router.push('/region')} topInset={insets.top} />
  );
}
