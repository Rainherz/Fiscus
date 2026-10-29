import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { AppHeader } from '@/shared/ui/AppHeader';
import { HeaderNav } from '@/shared/ui/HeaderNav';

import { useScope } from './ScopeContext';

interface Props {
  /** Tablet and desktop: the main sections shown in the header, with the current one. */
  nav?: {
    items: readonly { name: string; title: string }[];
    active: string;
    onSelect: (name: string) => void;
  };
}

/** Container: app header whose selector opens the region picker screen (`/region`), where the level and status are chosen too. */
export function RegionHeader({ nav }: Props) {
  const { label, levelLabel, statusLabel, ready } = useScope();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <AppHeader
      scopeLabel={ready ? label : null}
      levelLabel={ready ? levelLabel : null}
      statusLabel={ready ? statusLabel : null}
      onPressScope={() => {
        blurActiveElement();
        router.push('/region');
      }}
      topInset={insets.top}
      nav={nav ? <HeaderNav items={nav.items} active={nav.active} onSelect={nav.onSelect} /> : undefined}
    />
  );
}
