import { createContext, useContext, type ReactNode } from 'react';

const HeaderAccessoryContext = createContext<ReactNode>(null);

/**
 * What every screen header shows right below its bar (the stale-data banner). Provided once by the
 * composition root, so the shared headers stay free of feature code.
 */
export function HeaderAccessoryProvider({ accessory, children }: { accessory: ReactNode; children: ReactNode }) {
  return <HeaderAccessoryContext.Provider value={accessory}>{children}</HeaderAccessoryContext.Provider>;
}

/** Rendered by AppHeader and BackHeader after their bar; nothing outside a provider. */
export function HeaderAccessory() {
  return <>{useContext(HeaderAccessoryContext)}</>;
}
