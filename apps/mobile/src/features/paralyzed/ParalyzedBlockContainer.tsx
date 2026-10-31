import { Linking } from 'react-native';

import { useParalyzedDetail } from '@/features/investments/hooks/queries';

import { ParalyzedBlock } from './ParalyzedBlock';

/**
 * The detail screen's Contraloría block, only when the CUI is in the latest edition. Nothing shows
 * while loading or when the read fails: the rest of the detail does not depend on it.
 */
export function ParalyzedBlockContainer({ cui }: { cui: string }) {
  const detail = useParalyzedDetail(cui);
  if (!detail.data) return null;
  return (
    <ParalyzedBlock
      detail={detail.data}
      now={new Date()}
      // react-native-web opens it in a new tab; iOS and Android in the system browser.
      onOpenUrl={(url) => {
        Linking.openURL(url).catch(() => {});
      }}
    />
  );
}
