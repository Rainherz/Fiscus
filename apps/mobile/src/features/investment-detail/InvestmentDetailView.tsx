import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  hasInvalidUpdatedCost,
  spentOverUpdatedCost,
  type Investment,
} from '@/features/investments/domain/investment';
import { stalledStatus } from '@/features/investments/domain/stalled';
import { regionLabel } from '@/features/department/departments';
import { levelName, levelTag } from '@/features/government-level/levelPresentation';
import { stalledSinceSentence } from '@/features/stalled/stalledPresentation';
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
import { colors, maxContentWidth, minTouch, rule, space } from '@/shared/theme/tokens';
import { sourceNameOf } from '@/shared/ui/DataFooter';
import { HazardProgressBar } from '@/shared/ui/HazardProgressBar';
import { LevelTag } from '@/shared/ui/LevelTag';
import { BodyText, DisplayText, MonoText } from '@/shared/ui/typography';

interface Props {
  investment: Investment;
  now: Date;
  /** "Historial del costo" section, shown after the cost figures. */
  costHistory?: ReactNode;
  /** Latest accrual month of the dataset; null or absent while unknown. */
  referenceMonth?: string | null;
  /** Opens the share-as-image preview; the button is hidden when absent. */
  onShare?: () => void;
}

const DASH = '—';
const INVALID_COST_NOTICE = 'Costo actualizado no válido en la fuente MEF';

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

/**
 * Physical progress as MEF publishes it (0-100): a plain ink bar, unlike the striped "gastado"
 * bar, so the two are not read as the same figure.
 */
function PhysicalProgress({ percent }: { percent: number }) {
  const shown = formatProgress(percent / 100);
  const fill = Math.min(Math.max(percent, 0), 100);
  return (
    <View style={styles.physical}>
      <MonoText bold size={12}>{`AVANCE FÍSICO ${shown}`}</MonoText>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Avance físico: ${Math.round(percent)} por ciento, reportado al MEF`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(fill) }}
        style={styles.physicalTrack}>
        <View style={[styles.physicalFill, { width: `${fill}%` }]} />
      </View>
      <MonoText size={11} muted>
        Avance de la obra reportado al MEF. No es lo gastado.
      </MonoText>
    </View>
  );
}

export function InvestmentDetailView({
  investment: inv,
  now,
  costHistory,
  referenceMonth = null,
  onShare,
}: Props) {
  const invalidCost = hasInvalidUpdatedCost(inv);
  const stalled = stalledStatus(inv, referenceMonth);
  const increased = (inv.costIncrease ?? 0) > 0;
  const viable = formatSoles(inv.viableAmount);
  const updated = formatSoles(inv.updatedCost);

  const tag = levelTag(inv.governmentLevel);
  const optional = (label: string, value: string | null): [string, string][] => (value ? [[label, value]] : []);
  const facts: [string, string][] = [
    ...optional('Nivel de gobierno', inv.governmentLevel ? levelName(inv.governmentLevel) : null),
    ['Entidad', inv.entity ?? DASH],
    ...optional('Unidad ejecutora', inv.executingUnit),
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
    ['Región', inv.departmentCode === null ? regionLabel(null) : (inv.departmentName ?? DASH)],
    ...optional('Provincia', inv.province),
    ...optional('Distrito', inv.district),
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View style={styles.identity}>
          {tag ? <LevelTag tag={tag} /> : null}
          <MonoText bold size={11} muted>{`CUI ${inv.cui}`}</MonoText>
        </View>
        <DisplayText size={30} accessibilityRole="header" style={styles.name}>
          {inv.name ?? 'Sin nombre'}
        </DisplayText>
        {onShare ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compartir este proyecto como imagen"
            onPress={onShare}
            style={({ pressed }) => [styles.shareButton, pressed && styles.shareButtonPressed]}>
            <MonoText bold size={13}>
              COMPARTIR
            </MonoText>
          </Pressable>
        ) : null}
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
          {invalidCost ? (
            <View style={styles.notice}>
              <MonoText bold size={14}>
                {INVALID_COST_NOTICE}
              </MonoText>
              <MonoText size={11} muted>
                {`El MEF publica ${updated} como costo actualizado. No se calculan el aumento ni el porcentaje gastado.`}
              </MonoText>
            </View>
          ) : (
            <DisplayText
              weight={900}
              size={56}
              numberOfLines={1}
              adjustsFontSizeToFit
              accessibilityLabel={`Costo actualizado: ${updated}`}>
              {updated}
            </DisplayText>
          )}
        </View>
        {invalidCost ? null : (
          <View style={[styles.increase, increased && styles.increaseUp]}>
            <MonoText size={11} style={styles.increaseLabel}>
              AUMENTO
            </MonoText>
            <MonoText bold size={15}>
              {`${formatSignedSoles(inv.costIncrease)} · ${formatSignedPercent(inv.costIncreasePct)}`}
            </MonoText>
          </View>
        )}
      </View>

      {invalidCost ? null : (
        <View style={styles.progress}>
          <MonoText bold size={12}>{`GASTADO ${formatProgress(inv.executionProgress)} DEL COSTO`}</MonoText>
          <HazardProgressBar
            ratio={inv.executionProgress}
            overspend={spentOverUpdatedCost(inv)}
            anomaly={inv.spentAnomaly}
          />
          {stalled ? (
            <MonoText bold size={12} style={styles.stalled}>
              {stalledSinceSentence(stalled)}
            </MonoText>
          ) : null}
        </View>
      )}

      {inv.physicalProgress !== null ? <PhysicalProgress percent={inv.physicalProgress} /> : null}

      {costHistory}

      <View style={styles.facts}>
        {facts.map(([label, value]) => (
          <Fact key={label} label={label} value={value} />
        ))}
      </View>

      <MonoText size={11} muted style={styles.source}>
        {`Fuente: ${sourceNameOf(inv.dataSource)}.${
          inv.sourceUpdatedAt ? ` Último cambio en los datos del MEF: ${formatDate(inv.sourceUpdatedAt)}.` : ''
        }`}
      </MonoText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  content: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', paddingBottom: space.xl },
  head: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: 6 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  physical: { marginTop: space.lg, marginHorizontal: space.lg, gap: space.sm },
  physicalTrack: { height: 12, borderWidth: rule, borderColor: colors.ink, backgroundColor: colors.concrete },
  physicalFill: { height: '100%', backgroundColor: colors.ink },
  name: { lineHeight: 30 },
  shareButton: {
    alignSelf: 'flex-start',
    minHeight: minTouch,
    justifyContent: 'center',
    borderWidth: rule,
    borderColor: colors.ink,
    paddingHorizontal: space.lg,
    marginTop: space.xs,
  },
  shareButtonPressed: { backgroundColor: colors.concretePressed },
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
  notice: {
    borderWidth: rule,
    borderColor: colors.ink,
    borderStyle: 'dashed',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.xs,
  },
  increaseLabel: { color: colors.ink },
  progress: { marginTop: space.lg, marginHorizontal: space.lg, gap: space.sm },
  stalled: {
    borderLeftWidth: 3,
    borderLeftColor: colors.ink,
    paddingLeft: space.sm,
  },
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
