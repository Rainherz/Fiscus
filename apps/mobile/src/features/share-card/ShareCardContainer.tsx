import { useRef, useState, type ComponentRef } from 'react';
import type { View } from 'react-native';

import type { Investment } from '@/features/investments/domain/investment';
import { siteUrlFromEnv } from '@/shared/site/siteUrl';

import { ShareCard } from './ShareCard';
import { captureCard, shareCardImage } from './shareCardImage';
import { shareCardContent } from './shareCardPresentation';
import { SharePreviewModal, type SharePreviewStatus } from './SharePreviewModal';

interface Props {
  investment: Investment;
  referenceMonth: string | null;
  onClose: () => void;
}

export const SHARE_UNAVAILABLE = 'Tu dispositivo no permite compartir imágenes.';
export const CAPTURE_FAILED = 'No se pudo generar la imagen.';
export const SHARE_FAILED = 'No se pudo compartir la imagen.';

/**
 * Renders the card off screen, captures it once laid out, previews the resulting PNG and shares
 * that same file, so people see exactly what they send. Mount it while sharing; unmount to close.
 */
export function ShareCardContainer({ investment, referenceMonth, onClose }: Props) {
  const content = shareCardContent(investment, { referenceMonth, siteUrl: siteUrlFromEnv() });
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const capturing = useRef(false);
  const [status, setStatus] = useState<SharePreviewStatus>('preparing');
  const [uri, setUri] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const capture = async () => {
    if (capturing.current || !cardRef.current) return;
    capturing.current = true;
    // One frame so the native view is drawn before it is snapshotted.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      setUri(await captureCard(cardRef.current));
      setStatus('ready');
    } catch {
      setMessage(CAPTURE_FAILED);
      setStatus('error');
    }
  };

  const share = async () => {
    if (!uri) return;
    setStatus('sharing');
    setMessage(null);
    try {
      const result = await shareCardImage(uri, {
        cui: investment.cui,
        text: content.shareText,
        url: content.link?.url ?? null,
      });
      if (result === 'shared' || result === 'downloaded') {
        onClose();
        return;
      }
      if (result === 'unavailable') setMessage(SHARE_UNAVAILABLE);
    } catch {
      setMessage(SHARE_FAILED);
    }
    setStatus('ready');
  };

  return (
    <SharePreviewModal
      status={status}
      imageUri={uri}
      imageLabel={`Vista previa de la imagen: ${content.accessibilityLabel}`}
      message={message}
      onShare={share}
      onCancel={onClose}
      offscreenCard={
        status === 'preparing' ? (
          <ShareCard ref={cardRef} content={content} onLayout={capture} />
        ) : null
      }
    />
  );
}
