import { router } from 'expo-router';
import { useContext, useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { isWide } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { BodyText, DisplayText, MonoText } from '@/shared/ui/typography';

import { popoverPosition, POPOVER_WIDTH, type Anchor } from './popoverPosition';
import { termById, type TermId } from './terms';

/** Visible size of the "?" button; hitSlop brings the touch target to 44 px. */
const SIZE = 18;
const HIT_SLOP = Math.ceil((minTouch - SIZE) / 2);

export const GUIDE_PATH = '/guia';

function TermDefinition({ id, onClose }: { id: TermId; onClose: () => void }) {
  const term = termById(id);
  return (
    <View style={styles.definition}>
      <View style={styles.titleRow}>
        <DisplayText size={20} accessibilityRole="header" style={styles.title}>
          {term.term}
        </DisplayText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <MonoText bold size={18}>
            ×
          </MonoText>
        </Pressable>
      </View>
      <BodyText size={15}>{term.definition}</BodyText>
      {term.extra ? (
        <BodyText size={14} muted>
          {term.extra}
        </BodyText>
      ) : null}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Ver guía completa"
        onPress={() => {
          onClose();
          router.push(GUIDE_PATH);
        }}
        style={({ pressed }) => [styles.guide, pressed && styles.pressed]}>
        <DisplayText size={18}>Ver guía completa →</DisplayText>
      </Pressable>
    </View>
  );
}

/**
 * Small "?" next to a label. It opens the term's definition: a popover by the button on tablet
 * and desktop, a bottom sheet on phones. Both close with the × button, the backdrop or Escape.
 */
export function TermHint({
  term,
  onInk = false,
}: {
  term: TermId;
  /** On an ink background (a highlighted table header): drawn in signal yellow. */
  onInk?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const button = useRef<ComponentRef<typeof View>>(null);
  const wide = isWide(useBreakpoint());
  const window = useWindowDimensions();
  // The context, not useSafeAreaInsets: hints also render in views tested without a provider.
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const close = () => setOpen(false);

  const show = () => {
    setAnchor(null);
    setOpen(true);
    button.current?.measureInWindow?.((x, y, width, height) => setAnchor({ x, y, width, height }));
  };

  return (
    <>
      <Pressable
        ref={button}
        accessibilityRole="button"
        accessibilityLabel={`Qué significa ${termById(term).term}`}
        hitSlop={HIT_SLOP}
        onPress={show}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.hint,
          onInk && styles.hintOnInk,
          (pressed || hovered) && (onInk ? styles.hintOnInkActive : styles.hintActive),
        ]}>
        {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
          <MonoText
            bold
            size={11}
            style={[
              styles.hintText,
              onInk && styles.hintTextOnInk,
              (pressed || hovered) && (onInk ? styles.hintTextOnInkActive : styles.hintTextActive),
            ]}>
            ?
          </MonoText>
        )}
      </Pressable>
      {open ? (
        <Modal transparent visible animationType={wide ? 'none' : 'slide'} onRequestClose={close}>
          <Pressable
            testID="term-backdrop"
            accessibilityLabel="Cerrar definición"
            onPress={close}
            style={[styles.backdrop, !wide && styles.backdropDim]}
          />
          {wide ? (
            <View
              testID="term-popover"
              role="dialog"
              accessibilityViewIsModal
              style={[styles.popover, popoverPosition(anchor, window)]}>
              <TermDefinition id={term} onClose={close} />
            </View>
          ) : (
            <View
              testID="term-sheet"
              role="dialog"
              accessibilityViewIsModal
              style={[styles.sheet, { paddingBottom: bottomInset + space.md }]}>
              <TermDefinition id={term} onClose={close} />
            </View>
          )}
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hint: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintActive: { backgroundColor: colors.ink },
  hintText: { color: colors.ink, lineHeight: 13 },
  hintTextActive: { color: colors.signal },
  hintOnInk: { borderColor: colors.signal },
  hintOnInkActive: { backgroundColor: colors.signal },
  hintTextOnInk: { color: colors.signal },
  hintTextOnInkActive: { color: colors.ink },
  backdrop: StyleSheet.absoluteFill,
  backdropDim: { backgroundColor: 'rgba(17, 17, 17, 0.5)' },
  popover: {
    position: 'absolute',
    width: POPOVER_WIDTH,
    backgroundColor: colors.concrete,
    borderWidth: rule,
    borderColor: colors.ink,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.concrete,
    borderTopWidth: rule,
    borderTopColor: colors.ink,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  definition: { gap: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  title: { flexShrink: 1 },
  close: { minWidth: minTouch, minHeight: minTouch, alignItems: 'flex-end', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  guide: { minHeight: minTouch, justifyContent: 'center', borderTopWidth: rule, borderTopColor: colors.ink },
});
