import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from './shareCardPresentation';

export type SharePreviewStatus = 'preparing' | 'ready' | 'sharing' | 'error';

interface Props {
  status: SharePreviewStatus;
  imageUri: string | null;
  imageLabel: string;
  message: string | null;
  onShare: () => void;
  onCancel: () => void;
  /** The full-size card being captured; kept out of view and out of the accessibility tree. */
  offscreenCard: ReactNode;
}

const PREVIEW_MAX_WIDTH = 420;
/** Height taken by the title, the buttons, the message and the paddings around the preview. */
const CHROME_HEIGHT = 240;
/** Width around the preview: backdrop and sheet paddings plus the sheet and preview borders. */
const CHROME_WIDTH = space.md * 2 + space.lg * 2 + rule * 4;

export function SharePreviewModal({
  status,
  imageUri,
  imageLabel,
  message,
  onShare,
  onCancel,
  offscreenCard,
}: Props) {
  const window = useWindowDimensions();
  const width = Math.max(
    160,
    Math.min(
      window.width - CHROME_WIDTH,
      PREVIEW_MAX_WIDTH,
      ((window.height - CHROME_HEIGHT) * SHARE_CARD_WIDTH) / SHARE_CARD_HEIGHT,
    ),
  );
  const height = (width * SHARE_CARD_HEIGHT) / SHARE_CARD_WIDTH;
  const canShare = imageUri !== null && status === 'ready';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <DisplayText size={22} accessibilityRole="header" style={styles.title}>
            Compartir como imagen
          </DisplayText>

          <View style={[styles.preview, { width: width + rule * 2, height: height + rule * 2 }]}>
            {imageUri ? (
              <Image
                accessible
                accessibilityRole="image"
                accessibilityLabel={imageLabel}
                source={{ uri: imageUri }}
                style={{ width, height }}
                resizeMode="contain"
              />
            ) : status === 'preparing' ? (
              <View style={styles.placeholder}>
                <ActivityIndicator color={colors.ink} />
                <MonoText size={12}>Preparando imagen…</MonoText>
              </View>
            ) : null}
          </View>

          {message ? (
            <MonoText bold size={13} accessibilityRole="alert" style={styles.message}>
              {message}
            </MonoText>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
              onPress={onCancel}
              style={({ pressed }) => [styles.button, pressed && styles.cancelPressed]}>
              <MonoText bold size={14}>
                CANCELAR
              </MonoText>
            </Pressable>
            {imageUri ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Compartir"
                accessibilityState={{ disabled: !canShare, busy: status === 'sharing' }}
                disabled={!canShare}
                onPress={onShare}
                style={({ pressed }) => [
                  styles.button,
                  styles.share,
                  pressed && styles.sharePressed,
                  !canShare && styles.disabled,
                ]}>
                <MonoText bold size={14}>
                  COMPARTIR
                </MonoText>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View
          style={styles.offscreen}
          pointerEvents="none"
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {offscreenCard}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  sheet: {
    backgroundColor: colors.concrete,
    borderWidth: rule,
    borderColor: colors.ink,
    padding: space.lg,
    gap: space.md,
  },
  title: { lineHeight: 24 },
  preview: {
    alignSelf: 'center',
    borderWidth: rule,
    borderColor: colors.ink,
    backgroundColor: colors.concrete,
    overflow: 'hidden',
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  message: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: space.md },
  button: {
    flex: 1,
    minHeight: minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: rule,
    borderColor: colors.ink,
    paddingHorizontal: space.md,
  },
  cancelPressed: { backgroundColor: colors.concretePressed },
  share: { backgroundColor: colors.signal },
  sharePressed: { backgroundColor: colors.signalPressed },
  disabled: { opacity: 0.5 },
  // Laid out at full size far outside the screen: captured, never seen.
  offscreen: { position: 'absolute', left: -SHARE_CARD_WIDTH * 4, top: 0 },
});
