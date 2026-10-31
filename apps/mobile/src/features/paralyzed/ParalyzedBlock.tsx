import { Pressable, StyleSheet, View } from 'react-native';

import { TermHint } from '@/features/glossary/TermHint';
import { infobrasUrl, type ParalyzedDetail, type ParalyzedWork } from '@/features/investments/domain/paralyzed';
import { formatInteger, formatSoles, formatSolesCompact } from '@/shared/format';
import { colors, minTouch, space } from '@/shared/theme/tokens';
import { BodyText, MonoText } from '@/shared/ui/typography';

import {
  PARALYZED_ATTRIBUTION,
  PARALYZED_TITLE,
  paralyzedCausal,
  paralyzedEditionLine,
  paralyzedProgressText,
} from './paralyzedPresentation';

interface Props {
  detail: ParalyzedDetail;
  now: Date;
  /** Opens an external page (INFOBRAS ficha, MEF report) in the system browser or a new tab. */
  onOpenUrl: (url: string) => void;
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.figure}>
      <MonoText size={10} style={styles.onInkMuted}>
        {label.toUpperCase()}
      </MonoText>
      <MonoText bold size={15} style={styles.onInk}>
        {value}
      </MonoText>
    </View>
  );
}

function ExternalLink({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
      <MonoText bold size={12} style={styles.signal}>
        {`${label} →`}
      </MonoText>
    </Pressable>
  );
}

function obraLine(work: ParalyzedWork): string {
  const progress = work.physicalProgress === null ? '—' : `${formatInteger(work.physicalProgress)} %`;
  return `Obra ${work.infobrasCode} · ${paralyzedCausal(work.causalLabel)} · avance ${progress} · saldo ${formatSolesCompact(work.remainingWorkBalance)}`;
}

/** Links of one obra: its INFOBRAS ficha and, when filed, the MEF situational report. */
function ObraLinks({ work, several, onOpenUrl }: { work: ParalyzedWork; several: boolean; onOpenUrl: (url: string) => void }) {
  const of = several ? ` de la obra ${work.infobrasCode}` : '';
  return (
    <View style={styles.links}>
      <ExternalLink
        label="Ver ficha en INFOBRAS"
        accessibilityLabel={`Ver ficha en INFOBRAS${of}`}
        onPress={() => onOpenUrl(infobrasUrl(work.infobrasCode))}
      />
      {work.mefReportUrl ? (
        <ExternalLink
          label="Informe situacional del MEF"
          accessibilityLabel={`Informe situacional del MEF${of}`}
          onPress={() => onOpenUrl(work.mefReportUrl!)}
        />
      ) : null}
    </View>
  );
}

/**
 * "PARALIZADA SEGÚN LA CONTRALORÍA" on the detail screen: the official record, in ink and signal so
 * it is not read as the "Sin gasto reciente" line (a rule of Fiscus, drawn as a plain ink rule).
 */
export function ParalyzedBlock({ detail, now, onOpenUrl }: Props) {
  const { summary, works } = detail;
  const several = works.length > 1;
  return (
    <View testID="paralyzed" style={styles.block}>
      <View style={styles.head}>
        <MonoText bold size={13} accessibilityRole="header" style={[styles.signal, styles.shrink]}>
          {PARALYZED_TITLE}
        </MonoText>
        <TermHint term="obra-paralizada" onInk />
      </View>
      <BodyText weight={600} size={16} style={styles.onInk}>
        {`Causal: ${paralyzedCausal(summary.mainCausalLabel)}`}
      </BodyText>
      <View style={styles.figures}>
        <Figure label="Avance físico" value={paralyzedProgressText(summary)} />
        <Figure label="Saldo de obra" value={formatSoles(summary.totalRemainingWorkBalance)} />
        {summary.obraCount > 1 ? <Figure label="Obras" value={formatInteger(summary.obraCount)} /> : null}
      </View>
      {several ? (
        works.map((work) => (
          <View key={work.infobrasCode} style={styles.obra}>
            <MonoText size={11} style={styles.onInk}>
              {obraLine(work)}
            </MonoText>
            <ObraLinks work={work} several onOpenUrl={onOpenUrl} />
          </View>
        ))
      ) : works[0] ? (
        <ObraLinks work={works[0]} several={false} onOpenUrl={onOpenUrl} />
      ) : null}
      <MonoText size={11} style={styles.onInkMuted}>
        {paralyzedEditionLine(summary, now)}
      </MonoText>
      <MonoText size={11} style={styles.onInkMuted}>
        {PARALYZED_ATTRIBUTION}
      </MonoText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: space.lg,
    marginHorizontal: space.lg,
    backgroundColor: colors.ink,
    borderLeftWidth: 6,
    borderLeftColor: colors.signal,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    gap: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  shrink: { flexShrink: 1 },
  signal: { color: colors.signal },
  onInk: { color: colors.concrete },
  onInkMuted: { color: colors.concrete, opacity: 0.8 },
  figures: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs },
  figure: { gap: 2 },
  obra: { borderTopWidth: 1, borderTopColor: colors.muted, paddingTop: space.sm, gap: 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg },
  link: { minHeight: minTouch, justifyContent: 'center' },
  linkPressed: { opacity: 0.7 },
});
