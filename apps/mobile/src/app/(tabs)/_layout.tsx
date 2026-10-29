import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { RegionHeader } from '@/features/department/RegionHeader';
import { navPlacement } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { GUIDE_NAV_ITEM, MAIN_TABS } from '@/shared/navigation/mainTabs';
import { TabBar } from '@/shared/ui/TabBar';

/**
 * Phones: bottom tab bar. Tablet and desktop: the same tabs as a navigation in the header, plus
 * the guide on desktop.
 */
export default function TabsLayout() {
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const inHeader = navPlacement(breakpoint) === 'header';
  // The guide is a fifth header item only on desktop; on tablet it does not fit next to the selector.
  const navItems = breakpoint === 'desktop' ? [...MAIN_TABS, GUIDE_NAV_ITEM] : MAIN_TABS;
  return (
    <Tabs
      tabBar={(props) => (inHeader ? null : <TabBar {...props} />)}
      screenOptions={{
        header: ({ route, navigation }) => (
          <RegionHeader
            nav={
              inHeader
                ? {
                    items: navItems,
                    active: route.name,
                    onSelect: (name) => {
                      if (name === route.name) return;
                      blurActiveElement();
                      if (name === GUIDE_NAV_ITEM.name) router.push('/guia');
                      else navigation.navigate(name);
                    },
                  }
                : undefined
            }
          />
        ),
      }}>
      {MAIN_TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
    </Tabs>
  );
}
