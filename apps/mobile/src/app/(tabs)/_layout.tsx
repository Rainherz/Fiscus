import { Tabs } from 'expo-router/js-tabs';

import { RegionHeader } from '@/features/department/RegionHeader';
import { navPlacement } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { MAIN_TABS } from '@/shared/navigation/mainTabs';
import { TabBar } from '@/shared/ui/TabBar';

/** Phones: bottom tab bar. Tablet and desktop: the same tabs as a navigation in the header. */
export default function TabsLayout() {
  const inHeader = navPlacement(useBreakpoint()) === 'header';
  return (
    <Tabs
      tabBar={(props) => (inHeader ? null : <TabBar {...props} />)}
      screenOptions={{
        header: ({ route, navigation }) => (
          <RegionHeader
            nav={
              inHeader
                ? {
                    items: MAIN_TABS,
                    active: route.name,
                    onSelect: (name) => {
                      if (name === route.name) return;
                      blurActiveElement();
                      navigation.navigate(name);
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
