import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TermHint } from '@/features/glossary/TermHint';
import type { TermId } from '@/features/glossary/terms';
import type { InfobrasWork } from '@/features/investments/domain/infobras';
import { infobrasUrl } from '@/features/investments/domain/paralyzed';
import { formatInteger } from '@/shared/format';
import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { BodyText, MonoText } from '@/shared/ui/typography';

import { INFOBRAS_TITLE, infobrasCaveat, infobrasObraFacts, visibleInfobrasWorks } from './infobrasPresentation';

interface Props {
  works: readonly InfobrasWork[];
  /** yyyy-mm-dd: the date the INFOBRAS data describes. */
  dataAsOf: string | null;
  /** Opens the INFOBRAS ficha in the system browser or a new tab. */
  onOpenUrl: (url: string) => void;
}

/** Fact labels explained by a glossary hint. */
const FACT_TERMS: Partial<Record<string, TermId>> = {
  Contratista: 'contratista',
  Supervisión: 'supervision',
  'Adicionales de obra': 'adicional-de-obra',
  Deductivos: 'deductivo',
  'Ampliaciones de plazo': 'ampliacion-de-plazo',
};

/** The hint of a contract amount shown as not valid. */
const INVALID_CONTRACT_TERM: TermId = 'monto-contrato-no-valido';

function Obra({ work, onOpenUrl }: { work: InfobrasWork; onOpenUrl: (url: string) => void }) {
  return (
    <View testID={`infobras-obra-${work.infobrasCode}`} style={styles.obra}>
      <MonoText bold size={12}>{`Obra ${work.infobrasCode}`}</MonoText>
      {infobrasObraFacts(work).map((fact) => {
        const term = fact.invalid ? INVALID_CONTRACT_TERM : FACT_TERMS[fact.label];
        return (
          <View key={fact.label} style={styles.fact}>
            <View style={styles.label}>
              <MonoText size={11} muted>
                {fact.label.toUpperCase()}
              </MonoText>
              {term ? <TermHint term={term} /> : null}
            </View>
            {fact.invalid ? (
              <BodyText size={14} muted>
                {fact.value}
              </BodyText>
            ) : (
              <BodyText size={15}>{fact.value}</BodyText>
            )}
          </View>
        );
      })}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Ver ficha en INFOBRAS de la obra ${work.infobrasCode}`}
        onPress={() => onOpenUrl(infobrasUrl(work.infobrasCode))}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
        <MonoText bold size={12} style={styles.underline}>
          Ver ficha en INFOBRAS →
        </MonoText>
      </Pressable>
    </View>
  );
}

/**
 * "OBRAS EN INFOBRAS" on the detail screen: each obra the CUI has in INFOBRAS (five, then "Ver
 * más"), always with the date of the data. Drawn as a plain section: the Contraloría paralyzed
 * block, when present, stays the headline.
 */
export function InfobrasBlock({ works, dataAsOf, onOpenUrl }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { shown, hidden } = visibleInfobrasWorks(works, expanded);
  return (
    <View testID="infobras" style={styles.block}>
      <View style={styles.head}>
        <MonoText bold size={12} accessibilityRole="header">
          {INFOBRAS_TITLE}
        </MonoText>
        <TermHint term="infobras" />
      </View>
      {works.length > 1 ? (
        <MonoText size={11} muted>{`${formatInteger(works.length)} obras registradas para este CUI`}</MonoText>
      ) : null}
      {shown.map((work) => (
        <Obra key={work.infobrasCode} work={work} onOpenUrl={onOpenUrl} />
      ))}
      {hidden > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver más obras (${hidden})`}
          onPress={() => setExpanded(true)}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
          <MonoText bold size={12}>{`VER MÁS (${formatInteger(hidden)})`}</MonoText>
        </Pressable>
      ) : null}
      <MonoText size={11} muted>
        {infobrasCaveat(dataAsOf)}
      </MonoText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: space.lg, marginHorizontal: space.lg, gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  obra: { borderTopWidth: rule, borderTopColor: colors.ink, paddingTop: space.sm, gap: space.xs },
  fact: { gap: 2 },
  label: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  link: { minHeight: minTouch, justifyContent: 'center', alignSelf: 'flex-start' },
  underline: { textDecorationLine: 'underline' },
  more: {
    alignSelf: 'flex-start',
    minHeight: minTouch,
    justifyContent: 'center',
    borderWidth: rule,
    borderColor: colors.ink,
    paddingHorizontal: space.lg,
  },
  pressed: { opacity: 0.6 },
});
