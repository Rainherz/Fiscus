import { Platform } from 'react-native';

interface FocusDocument {
  activeElement: { blur?: () => void } | null;
}

/**
 * On web, the screen a navigation leaves gets `aria-hidden`; if the pressed button keeps focus the
 * browser blocks that ("Blocked aria-hidden on an element because its descendant retained focus").
 * Call this right before navigating from a pressed control. No-op on native.
 */
export function blurActiveElement(
  platform: string = Platform.OS,
  doc: FocusDocument | undefined = (globalThis as { document?: FocusDocument }).document,
): void {
  if (platform !== 'web') return;
  doc?.activeElement?.blur?.();
}
