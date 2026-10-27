import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/shared/ui/AppHeader';

import { useDepartment } from './DepartmentContext';
import { DepartmentPicker } from './DepartmentPicker';

/** Container: app header wired to the global department selection. */
export function RegionHeader() {
  const { code, name, setCode } = useDepartment();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <>
      <AppHeader departmentName={name} onPressDepartment={() => setOpen(true)} topInset={insets.top} />
      <DepartmentPicker
        visible={open}
        selectedCode={code}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onClose={() => setOpen(false)}
        onSelect={(next) => {
          setCode(next);
          setOpen(false);
        }}
      />
    </>
  );
}
