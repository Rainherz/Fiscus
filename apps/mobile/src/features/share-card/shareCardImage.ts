import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, shareFileName } from './shareCardPresentation';

type Os = typeof Platform.OS;

/** shared: handed to a share target; downloaded: saved by the browser; cancelled: sheet dismissed. */
export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'unavailable';

/**
 * Renders the card view to a 1080x1350 PNG: a temporary file on iOS/Android, a data URI on web
 * (react-native-view-shot draws the DOM with html2canvas-pro there).
 */
export async function captureCard(view: Parameters<typeof captureRef>[0], os: Os = Platform.OS): Promise<string> {
  // html2canvas draws text with the page's loaded fonts; wait so no fallback face is captured.
  if (os === 'web') await globalThis.document?.fonts?.ready;
  return captureRef(view, {
    format: 'png',
    result: os === 'web' ? 'data-uri' : 'tmpfile',
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
  });
}

async function shareNative(uri: string): Promise<ShareResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri.startsWith('file://') ? uri : `file://${uri}`, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: 'Compartir proyecto',
  });
  return 'shared';
}

/** Decodes synchronously: navigator.share needs the click's user activation, which awaits can lose. */
function dataUriToFile(dataUri: string, name: string): File {
  const binary = atob(dataUri.slice(dataUri.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: 'image/png' });
}

function download(dataUri: string, name: string): ShareResult {
  const anchor = document.createElement('a');
  anchor.href = dataUri;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return 'downloaded';
}

async function shareWeb(dataUri: string, cui: string): Promise<ShareResult> {
  const name = shareFileName(cui);
  const nav = globalThis.navigator as Partial<Navigator> | undefined;
  if (typeof nav?.canShare === 'function' && typeof nav.share === 'function') {
    const files = [dataUriToFile(dataUri, name)];
    if (nav.canShare({ files })) {
      try {
        await nav.share({ files });
        return 'shared';
      } catch (error) {
        if ((error as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
        // NotAllowedError and the like: the browser refused, so save the file instead.
      }
    }
  }
  return download(dataUri, name);
}

/** Shares a captured card: system share sheet on iOS/Android; Web Share API or a download on web. */
export function shareCardImage(uri: string, cui: string, os: Os = Platform.OS): Promise<ShareResult> {
  return os === 'web' ? shareWeb(uri, cui) : shareNative(uri);
}
