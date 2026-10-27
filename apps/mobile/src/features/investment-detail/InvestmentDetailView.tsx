import { ScrollView, StyleSheet, View } from 'react-native';

import type { Investment } from '@/features/investments/domain/investment';
import {
  formatDate,
  formatInteger,
  formatMonth,
  formatProgress,
  formatSignedPercent,
  formatSignedSoles,
  formatSoles,
  formatYears,
  yearsSince,
} from '@/shared/format';
import { colors, maxContentWidth, rule, space } from '@/shared/theme/tokens';
import { SOURCE_NAME } from '@/shared/ui/DataFooter';
import { HazardProgressBar } from '@/shared/ui/HazardProgressBar';
import { BodyText, DisplayText, MonoText } from '@/shared/ui/typography';

interface Props {
  investment: Investment;
  now: Date;
}

const DASH = '—';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.fact}>
      <MonoText size={11} muted style={styles.factLabel}>
        {label.toUpperCase()}
      </MonoText>
      <BodyText weight={600} size={15}>
        {value}
      </BodyText>
    </View>
  );
}

export function InvestmentDetailView({ investment: inv, now }: Props) {
  const increased = (inv.costIncrease ?? 0) > 0;
  const viable = formatSoles(inv.viableAmount);
  const updated = formatSoles(inv.updatedCost);

  const facts: [string, string][] = [
    ['Entidad', inv.entity ?? DASH],
    ['Función', inv.function ?? DASH],
    ['División funcional', inv.functionalDivision ?? DASH],
    ['Grupo funcional', inv.functionalGroup ?? DASH],
    ['Estado', inv.status ?? DASH],
    ['Situación', inv.situation ?? DASH],
    ['Fecha de registro', formatDate(inv.registeredAt)],
    ['Fecha de viabilidad', formatDate(inv.viabilityAt)],
    ['Tiempo desde la viabilidad', formatYears(yearsSince(inv.viabilityAt, now))],
    ['Primer devengado', formatMonth(inv.firstAccrualMonth)],
    ['Último devengado', formatMonth(inv.lastAccrualMonth)],
    ['Devengado acumulado', formatSoles(inv.accruedTotal)],
    ['Beneficiarios', formatInteger(inv.beneficiaries)],
    ['Región', inv.departmentName ?? DASH],
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <MonoText bold size={11} muted>{`CUI ${inv.cui}`}</MonoText>
        <DisplayText size={30} accessibilityRole="header" style={styles.name}>
          {inv.name ?? 'Sin nombre'}
        </DisplayText>
      </View>

      <View style={styles.costs}>
        <View style={styles.costRow}>
          <MonoText size={11} muted>
            APROBADO (MONTO VIABLE)
          </MonoText>
          <MonoText
            testID="viable-amount"
            accessibilityLabel={`Monto viable: ${viable}`}
            size={16}
            style={increased ? styles.struck : undefined}>
            {viable}
          </MonoText>
        </View>
        <View style={styles.costRow}>
          <MonoText size={11} muted>
            CUESTA HOY (COSTO ACTUALIZADO)
          </MonoText>
          <DisplayText
            weight={900}
            size={56}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={`Costo actualizado: ${updated}`}>
            {updated}
          </DisplayText>
        </View>
        <View style={[styles.increase, increased && styles.increaseUp]}>
          <MonoText size={11} style={styles.increaseLabel}>
            AUMENTO
          </MonoText>
          <MonoText bold size={15}>
            {`${formatSignedSoles(inv.costIncrease)} · ${formatSignedPercent(inv.costIncreasePct)}`}
          </MonoText>
        </View>
      </View>

      <View style={styles.progress}>
        <MonoText bold size={12}>{`AVANCE ${formatProgress(inv.executionProgress)}`}</MonoText>
        <HazardProgressBar ratio={inv.executionProgress} />
      </View>

      <View style={styles.facts}>
        {facts.map(([label, value]) => (
          <Fact key={label} label={label} value={value} />
        ))}
      </View>

      <MonoText size={11} muted style={styles.source}>
        {`Fuente: ${SOURCE_NAME}.${inv.sourceUpdatedAt ? ` Actualizado el ${formatDate(inv.sourceUpdatedAt)}.` : ''}`}
      </MonoText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  content: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', paddingBottom: space.xl },
  head: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: 6 },
  name: { lineHeight: 30 },
  costs: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  costRow: { gap: 2 },
  struck: { textDecorationLine: 'line-through', textDecorationColor: colors.ink },
  increase: {
    borderWidth: rule,
    borderColor: colors.ink,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 2,
  },
  increaseUp: { backgroundColor: colors.signal },
  increaseLabel: { color: colors.ink },
  progress: { marginTop: space.lg, marginHorizontal: space.lg, gap: space.sm },
  facts: { marginTop: space.xl, marginHorizontal: space.lg },
  fact: {
    borderTopWidth: rule,
    borderTopColor: colors.ink,
    paddingVertical: space.sm + 2,
    gap: 2,
  },
  factLabel: { letterSpacing: 0.5 },
  source: { marginTop: space.lg, marginHorizontal: space.lg },
});
