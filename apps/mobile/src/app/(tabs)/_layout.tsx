import { Tabs } from 'expo-router/js-tabs';

import { RegionHeader } from '@/features/department/RegionHeader';
import { TabBar } from '@/shared/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ header: () => <RegionHeader /> }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="rankings" options={{ title: 'Rankings' }} />
      <Tabs.Screen name="categories" options={{ title: 'Categorías' }} />
      <Tabs.Screen name="search" options={{ title: 'Buscar' }} />
    </Tabs>
  );
}
