import { Linking } from 'react-native';

import { useInfobrasDetail } from '@/features/investments/hooks/queries';

import { InfobrasBlock } from './InfobrasBlock';

/**
 * The detail screen's INFOBRAS block, only when the CUI has obras there. Nothing shows while loading
 * or when the read fails: the rest of the detail does not depend on it.
 */
export function InfobrasBlockContainer({ cui }: { cui: string }) {
  const detail = useInfobrasDetail(cui);
  if (!detail.data || detail.data.works.length === 0) return null;
  return (
    <InfobrasBlock
      works={detail.data.works}
      dataAsOf={detail.data.dataAsOf}
      // react-native-web opens it in a new tab; iOS and Android in the system browser.
      onOpenUrl={(url) => {
        Linking.openURL(url).catch(() => {});
      }}
    />
  );
}
