import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_DEPARTMENT_CODE, departmentName } from './departments';

interface DepartmentState {
  code: number;
  name: string;
  setCode: (code: number) => void;
}

const DepartmentContext = createContext<DepartmentState | null>(null);

/** Global selected department (region), shared by every tab. */
export function DepartmentProvider({ children, initialCode = DEFAULT_DEPARTMENT_CODE }: { children: ReactNode; initialCode?: number }) {
  const [code, setCode] = useState(initialCode);
  const value = useMemo(() => ({ code, name: departmentName(code), setCode }), [code]);
  return <DepartmentContext.Provider value={value}>{children}</DepartmentContext.Provider>;
}

export function useDepartment(): DepartmentState {
  const state = useContext(DepartmentContext);
  if (!state) throw new Error('useDepartment must be used inside DepartmentProvider');
  return state;
}
