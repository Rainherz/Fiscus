import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { BodyText, MonoText } from '@/shared/ui/typography';

/**
 * `alert`: ink ground, signal text and edge, for an official warning (the Contraloría paralyzed
 * list). `neutral`: concrete ground, ink border and text with a signal edge, for a dated source
 * shown with the same structure (INFOBRAS).
 */
export type SourcePanelTone = 'alert' | 'neutral';

export interface SourcePanelLink {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}

/** One flowing text, so every row wraps the same way. */
export interface SourcePanelLine {
  text: string;
}

/** A glossary term of the panel's legend and its hint. */
export interface SourcePanelTerm {
  label: string;
  hint: ReactNode;
}

export interface SourcePanelItem {
  key: string;
  testID?: string;
  summary: string;
  lines?: readonly SourcePanelLine[];
  links: readonly SourcePanelLink[];
}

export interface SourcePanelFigure {
  label: string;
  value: string;
}

export interface SourcePanelProps {
  testID?: string;
  tone: SourcePanelTone;
  title: string;
  titleHint?: ReactNode;
  headline?: string;
  figures: readonly SourcePanelFigure[];
  /** Glossary terms the rows use, each hinted once in a legend under the figures instead of inside the rows. */
  terms?: readonly SourcePanelTerm[];
  /** One row per item: a summary line, optional lines and its links. */
  items?: readonly SourcePanelItem[];
  /** Links of the whole panel, when it has no rows. */
  links?: readonly SourcePanelLink[];
  more?: { label: string; onPress: () => void };
  footer: readonly string[];
}

function Figure({ figure, alert }: { figure: SourcePanelFigure; alert: boolean }) {
  return (
    <View accessible accessibilityLabel={`${figure.label}: ${figure.value}`} style={styles.figure}>
      <MonoText size={10} muted={!alert} style={alert && styles.onInkMuted}>
        {figure.label.toUpperCase()}
      </MonoText>
      <MonoText bold size={15} style={alert && styles.onInk}>
        {figure.value}
      </MonoText>
    </View>
  );
}

function Links({ links, alert }: { links: readonly SourcePanelLink[]; alert: boolean }) {
  return (
    <View style={styles.links}>
      {links.map((link) => (
        <Pressable
          key={link.accessibilityLabel}
          accessibilityRole="link"
          accessibilityLabel={link.accessibilityLabel}
          onPress={link.onPress}
          style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
          <MonoText bold size={12} style={alert ? styles.signal : styles.underline}>
            {`${link.label} →`}
          </MonoText>
        </Pressable>
      ))}
    </View>
  );
}

/** "TÉRMINOS  Contratista (?)  Supervisión (?) …": each term and its hint wrap as one unit. */
function Legend({ testID, terms, alert }: { testID?: string; terms: readonly SourcePanelTerm[]; alert: boolean }) {
  return (
    <View testID={testID ? `${testID}-terms` : undefined} style={styles.legend}>
      <MonoText size={10} muted={!alert} style={alert && styles.onInkMuted}>
        TÉRMINOS
      </MonoText>
      {terms.map((term) => (
        <View key={term.label} style={styles.term}>
          <MonoText size={11} muted={!alert} style={alert && styles.onInkMuted}>
            {term.label}
          </MonoText>
          {term.hint}
        </View>
      ))}
    </View>
  );
}

/** A boxed panel for one source: header, key figures, a compact row per item and a dated footer. */
export function SourcePanel({ testID, tone, title, titleHint, headline, figures, terms, items, links, more, footer }: SourcePanelProps) {
  const alert = tone === 'alert';
  return (
    <View testID={testID} style={[styles.block, alert ? styles.alert : styles.neutral]}>
      <View style={styles.head}>
        <MonoText bold size={13} accessibilityRole="header" style={[alert && styles.signal, styles.shrink]}>
          {title}
        </MonoText>
        {titleHint}
      </View>
      {headline ? (
        <BodyText weight={600} size={16} style={alert && styles.onInk}>
          {headline}
        </BodyText>
      ) : null}
      {figures.length ? (
        <View style={styles.figures}>
          {figures.map((figure) => (
            <Figure key={figure.label} figure={figure} alert={alert} />
          ))}
        </View>
      ) : null}
      {terms?.length ? <Legend testID={testID} terms={terms} alert={alert} /> : null}
      {items?.map((item) => (
        <View key={item.key} testID={item.testID} style={[styles.item, !alert && styles.itemNeutral]}>
          <MonoText size={11} bold={!alert} style={alert && styles.onInk}>
            {item.summary}
          </MonoText>
          {item.lines?.map((line) => (
            <MonoText key={line.text} size={11} muted={!alert} style={alert && styles.onInkMuted}>
              {line.text}
            </MonoText>
          ))}
          <Links links={item.links} alert={alert} />
        </View>
      ))}
      {links?.length ? <Links links={links} alert={alert} /> : null}
      {more ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={more.label}
          onPress={more.onPress}
          style={({ pressed }) => [styles.more, alert && styles.moreOnInk, pressed && styles.linkPressed]}>
          <MonoText bold size={12} style={alert && styles.signal}>
            {more.label}
          </MonoText>
        </Pressable>
      ) : null}
      {footer.map((line) => (
        <MonoText key={line} size={11} muted={!alert} style={alert && styles.onInkMuted}>
          {line}
        </MonoText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: space.lg,
    marginHorizontal: space.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    gap: space.sm,
  },
  alert: { backgroundColor: colors.ink, borderLeftWidth: 6, borderLeftColor: colors.signal },
  neutral: {
    backgroundColor: colors.concrete,
    borderWidth: rule,
    borderColor: colors.ink,
    borderLeftWidth: 4,
    borderLeftColor: colors.signal,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  shrink: { flexShrink: 1 },
  signal: { color: colors.signal },
  underline: { textDecorationLine: 'underline' },
  onInk: { color: colors.concrete },
  onInkMuted: { color: colors.concrete, opacity: 0.8 },
  figures: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs },
  figure: { gap: 2 },
  item: { borderTopWidth: 1, borderTopColor: colors.muted, paddingTop: space.sm, gap: 2 },
  itemNeutral: { borderTopColor: colors.ink },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md, rowGap: space.xs },
  term: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg },
  link: { minHeight: minTouch, justifyContent: 'center' },
  linkPressed: { opacity: 0.7 },
  more: {
    alignSelf: 'flex-start',
    minHeight: minTouch,
    justifyContent: 'center',
    borderWidth: rule,
    borderColor: colors.ink,
    paddingHorizontal: space.lg,
  },
  moreOnInk: { borderColor: colors.signal },
});
