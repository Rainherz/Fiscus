import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { AppHeader } from '@/shared/ui/AppHeader';

import { useScope } from './ScopeContext';

/** Container: app header whose selector opens the region picker screen (`/region`), where the level is chosen too. */
export function RegionHeader() {
  const { label, levelLabel, ready } = useScope();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <AppHeader
      scopeLabel={ready ? label : null}
      levelLabel={ready ? levelLabel : null}
      onPressScope={() => {
        blurActiveElement();
        router.push('/region');
      }}
      topInset={insets.top}
    />
  );
}
