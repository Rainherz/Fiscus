import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/shared/ui/AppHeader';

import { useDepartment } from './DepartmentContext';

/** Container: app header whose selector opens the region picker screen (`/region`). */
export function RegionHeader() {
  const { name } = useDepartment();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <AppHeader departmentName={name} onPressDepartment={() => router.push('/region')} topInset={insets.top} />;
}
