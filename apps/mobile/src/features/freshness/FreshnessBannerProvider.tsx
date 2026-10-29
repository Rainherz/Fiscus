import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { isSsiStale } from '@/features/investments/domain/freshness';
import { useDataFreshness } from '@/features/investments/hooks/queries';
import { HeaderAccessoryProvider } from '@/shared/ui/HeaderAccessory';

import { StaleDataBanner } from './StaleDataBanner';

interface BannerState {
  dismissed: boolean;
  dismiss: () => void;
  now: () => Date;
}

const BannerContext = createContext<BannerState | null>(null);

/** Container: the banner when the SSI data is stale and the reader has not dismissed it. */
function StaleDataBannerContainer() {
  const state = useContext(BannerContext);
  const freshness = useDataFreshness();
  if (!state || state.dismissed || !freshness.data) return null;
  if (!isSsiStale(freshness.data, state.now())) return null;
  const lastUpdatedAt = freshness.data.ssiLastSuccessAt;
  if (!lastUpdatedAt) return null;
  return <StaleDataBanner lastUpdatedAt={lastUpdatedAt} onDismiss={state.dismiss} />;
}

/**
 * Puts the stale-data banner under every screen header. A dismissal lasts for the session: it is
 * kept in memory only, so the notice comes back on the next app start or page load.
 */
export function FreshnessBannerProvider({
  children,
  now = () => new Date(),
}: {
  children: ReactNode;
  /** Injectable clock (tests). */
  now?: () => Date;
}) {
  const [dismissed, setDismissed] = useState(false);
  const state = useMemo(() => ({ dismissed, dismiss: () => setDismissed(true), now }), [dismissed, now]);
  return (
    <BannerContext.Provider value={state}>
      <HeaderAccessoryProvider accessory={<StaleDataBannerContainer />}>{children}</HeaderAccessoryProvider>
    </BannerContext.Provider>
  );
}
