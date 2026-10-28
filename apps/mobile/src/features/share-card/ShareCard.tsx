import type { ComponentRef, Ref } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { colors, space } from '@/shared/theme/tokens';
import { FIT_LETTER_SPACING_EM, fitFontSize } from '@/shared/ui/fitFontSize';
import { HazardProgressBar } from '@/shared/ui/HazardProgressBar';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, type ShareCardContent } from './shareCardPresentation';

const PADDING = 60;
const INNER_WIDTH = SHARE_CARD_WIDTH - PADDING * 2;
const HERO_BOX_PADDING = 28;
const CARD_RULE = 4;
const HERO_MAX = 280;
const HERO_MIN = 72;

interface Props {
  content: ShareCardContent;
  ref?: Ref<ComponentRef<typeof View>>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

function Hero({ hero }: { hero: ShareCardContent['hero'] }) {
  if (hero.kind === 'notice') {
    return (
      <View style={styles.notice}>
        <MonoText bold size={44} style={styles.noticeText}>
          {hero.text}
        </MonoText>
        {hero.detail ? (
          <MonoText size={30} style={styles.noticeDetail}>
            {hero.detail}
          </MonoText>
        ) : null}
      </View>
    );
  }
  const highlighted = hero.label === 'AUMENTO DEL COSTO';
  const width = highlighted ? INNER_WIDTH - 2 * (HERO_BOX_PADDING + CARD_RULE) : INNER_WIDTH;
  // Same glyph-advance fit as FitDisplayText, from the card's fixed width instead of a measurement.
  const size = fitFontSize({ text: hero.text, width, max: HERO_MAX, min: HERO_MIN });
  return (
    <View style={[styles.hero, highlighted && styles.heroHighlighted]}>
      <MonoText bold size={30} style={styles.heroLabel}>
        {hero.label}
      </MonoText>
      <DisplayText
        weight={900}
        size={size}
        numberOfLines={1}
        ellipsizeMode="clip"
        adjustsFontSizeToFit
        minimumFontScale={0.3}
        style={{ lineHeight: Math.round(size * 0.95), letterSpacing: size * FIT_LETTER_SPACING_EM }}>
        {hero.text}
      </DisplayText>
    </View>
  );
}

/**
 * The shared image, laid out at its real pixel size (1080x1350) so the capture needs no scaling.
 * Visual direction B: ink band, concrete ground, signal yellow, 4px rules.
 */
export function ShareCard({ content, ref, onLayout }: Props) {
  const [approved, ...rest] = content.costLines;
  return (
    <View ref={ref} testID="share-card" collapsable={false} onLayout={onLayout} style={styles.card}>
      <View style={styles.band}>
        <DisplayText weight={900} size={84} style={styles.brand}>
          {content.brand}
        </DisplayText>
        <MonoText bold size={34} numberOfLines={1} style={styles.region}>
          {content.region}
        </MonoText>
      </View>

      <View style={styles.body}>
        <DisplayText size={80} numberOfLines={3} ellipsizeMode="tail" style={styles.name}>
          {content.name}
        </DisplayText>

        <Hero hero={content.hero} />

        {content.costLines.length > 0 ? (
          <View style={styles.costs}>
            {approved ? <MonoText size={38}>{approved}</MonoText> : null}
            {rest.map((line) => (
              <MonoText key={line} bold size={38}>
                {line}
              </MonoText>
            ))}
          </View>
        ) : null}

        {content.spent ? (
          <View style={styles.spent}>
            <MonoText bold size={32}>
              {content.spent.label}
            </MonoText>
            <HazardProgressBar ratio={content.spent.ratio} height={56} />
            {content.spent.notes.map((note) => (
              <MonoText key={note} bold size={27} style={styles.note}>
                {note}
              </MonoText>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <MonoText size={24} muted style={styles.footerText}>
          {content.footer}
        </MonoText>
        {content.link ? (
          <MonoText bold size={26} numberOfLines={1} style={styles.footerText}>
            {content.link.label}
          </MonoText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: colors.concrete,
    overflow: 'hidden',
  },
  band: {
    backgroundColor: colors.ink,
    paddingHorizontal: PADDING,
    paddingVertical: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xl,
  },
  brand: { color: colors.signal, lineHeight: 84 },
  region: { color: colors.concrete, flexShrink: 1, textAlign: 'right', letterSpacing: 2 },
  body: {
    flex: 1,
    paddingHorizontal: PADDING,
    paddingVertical: 48,
    gap: 36,
    overflow: 'hidden',
  },
  name: { lineHeight: 80 },
  hero: { gap: 4 },
  heroHighlighted: {
    backgroundColor: colors.signal,
    borderWidth: CARD_RULE,
    borderColor: colors.ink,
    paddingHorizontal: HERO_BOX_PADDING,
    paddingTop: 20,
    paddingBottom: 12,
  },
  heroLabel: { letterSpacing: 2 },
  notice: {
    borderWidth: CARD_RULE,
    borderColor: colors.ink,
    borderStyle: 'dashed',
    padding: HERO_BOX_PADDING,
    gap: 12,
  },
  noticeText: { lineHeight: 56 },
  noticeDetail: { lineHeight: 40 },
  costs: { gap: 6 },
  // Anchored above the footer, so the figures stay at the top whatever the variant holds.
  spent: { gap: 14, marginTop: 'auto' },
  note: { borderLeftWidth: 6, borderLeftColor: colors.ink, paddingLeft: 16, lineHeight: 36 },
  footer: {
    marginHorizontal: PADDING,
    borderTopWidth: CARD_RULE,
    borderTopColor: colors.ink,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 8,
  },
  footerText: { lineHeight: 32 },
});
