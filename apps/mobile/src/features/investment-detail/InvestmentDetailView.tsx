import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  hasInvalidUpdatedCost,
  spentOverUpdatedCost,
  type Investment,
  type InvestmentClosure,
} from '@/features/investments/domain/investment';
import { isClosed } from '@/features/investments/domain/investmentStatus';
import { originalClassification } from '@/features/investments/domain/functionCrosswalk';
import { stalledStatus } from '@/features/investments/domain/stalled';
import { TermHint } from '@/features/glossary/TermHint';
import type { TermId } from '@/features/glossary/terms';
import { regionLabel } from '@/features/department/departments';
import { levelName, projectTag } from '@/features/government-level/levelPresentation';
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
import { gutterFor, isWide, LAYOUT_MAX_WIDTH } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
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
  /** Opens the map centered on the project; shown only when it has coordinates. */
  onOpenMap?: () => void;
  /** "Paralizada según la Contraloría", shown under the name, before the figures. */
  paralyzed?: ReactNode;
}

const DASH = '—';
const INVALID_COST_NOTICE = 'Costo actualizado no válido en la fuente MEF';

/** Facts whose label has a glossary entry (one hint per group: Función covers its division and group). */
const FACT_TERMS: Partial<Record<string, TermId>> = {
  'Nivel de gobierno': 'nivel',
  Entidad: 'entidad',
  'Unidad ejecutora': 'unidad-ejecutora',
  Función: 'funcion',
  Estado: 'estado',
  'Devengado acumulado': 'devengado',
  Liquidación: 'liquidacion',
};

/** A small label followed by its term hint. */
function HintedLabel({ term, children }: { term: TermId; children: ReactNode }) {
  return (
    <View style={styles.hinted}>
      {children}
      <TermHint term={term} />
    </View>
  );
}

interface FactItem {
  label: string;
  value: string;
  /** A muted line under the value; the label's term hint moves next to it. */
  note?: string | null;
}

function Fact({ label, value, note, grid }: FactItem & { grid: boolean }) {
  const term = FACT_TERMS[label];
  const labelText = (
    <MonoText size={11} muted style={styles.factLabel}>
      {label.toUpperCase()}
    </MonoText>
  );
  const noteText = note ? (
    <MonoText size={11} muted style={styles.shrink}>
      {note}
    </MonoText>
  ) : null;
  // With a hint the fact cannot be one accessible element (the hint button would be unreachable).
  return (
    <View accessible={!term} accessibilityLabel={`${label}: ${value}`} style={[styles.fact, grid && styles.factGrid]}>
      {term && !noteText ? <HintedLabel term={term}>{labelText}</HintedLabel> : labelText}
      <BodyText weight={600} size={15}>
        {value}
      </BodyText>
      {noteText && term ? <HintedLabel term={term}>{noteText}</HintedLabel> : noteText}
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
      <HintedLabel term="avance-fisico">
        <MonoText bold size={12}>{`AVANCE FÍSICO ${shown}`}</MonoText>
      </HintedLabel>
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

/** The closure facts MEF publishes, in the order of the project's life; only those with a value. */
function closureFacts(closure: InvestmentClosure): FactItem[] {
  const date = (label: string, value: string | null): FactItem[] => (value ? [{ label, value: formatDate(value) }] : []);
  const liquidation: FactItem[] =
    closure.liquidationAmount !== null && closure.liquidationAmount > 0
      ? [
          {
            label: 'Liquidación',
            value: closure.liquidatedAt
              ? `${formatSoles(closure.liquidationAmount)}, el ${formatDate(closure.liquidatedAt)}`
              : formatSoles(closure.liquidationAmount),
          },
        ]
      : [];
  return [
    ...date('Fecha de cierre', closure.closedAt),
    ...(closure.description ? [{ label: 'Tipo de cierre', value: closure.description }] : []),
    ...(closure.culminated === null ? [] : [{ label: 'Culminada', value: closure.culminated ? 'Sí' : 'No' }]),
    ...liquidation,
    ...date('Inicio de ejecución física', closure.physicalStartAt),
    ...date('Fin de ejecución física', closure.physicalEndAt),
    ...date('Inicio de operación', closure.operationStartAt),
  ];
}

/** "Cierre de la inversión": what MEF publishes about the closure of a closed project. */
function ClosureSection({ closure, grid }: { closure: InvestmentClosure; grid: boolean }) {
  const facts = closureFacts(closure);
  if (facts.length === 0) return null;
  return (
    <View testID="closure" style={styles.closure}>
      <HintedLabel term="cierre">
        <MonoText bold size={12} accessibilityRole="header">
          CIERRE DE LA INVERSIÓN
        </MonoText>
      </HintedLabel>
      <View style={grid ? styles.factsGrid : undefined}>
        {facts.map((item) => (
          <Fact key={item.label} {...item} grid={grid} />
        ))}
      </View>
    </View>
  );
}

export function InvestmentDetailView({
  investment: inv,
  now,
  costHistory,
  referenceMonth = null,
  onShare,
  onOpenMap,
  paralyzed,
}: Props) {
  const invalidCost = hasInvalidUpdatedCost(inv);
  const stalled = stalledStatus(inv, referenceMonth);
  const increased = (inv.costIncrease ?? 0) > 0;
  const viable = formatSoles(inv.viableAmount);
  const updated = formatSoles(inv.updatedCost);

  const tag = projectTag(inv);
  const fact = (label: string, value: string): FactItem => ({ label, value });
  const optional = (label: string, value: string | null): FactItem[] => (value ? [fact(label, value)] : []);
  const original = originalClassification(inv.function, inv.functionalDivision, inv.functionCanonical);
  const facts: FactItem[] = [
    ...optional('Nivel de gobierno', inv.governmentLevel ? levelName(inv.governmentLevel) : null),
    fact('Entidad', inv.entity ?? DASH),
    ...optional('Unidad ejecutora', inv.executingUnit),
    {
      label: 'Función',
      value: inv.functionCanonical ?? DASH,
      note: original ? `Clasificación original del MEF: ${original}` : null,
    },
    fact('División funcional', inv.functionalDivision ?? DASH),
    fact('Grupo funcional', inv.functionalGroup ?? DASH),
    fact('Estado', inv.status ?? DASH),
    fact('Situación', inv.situation ?? DASH),
    fact('Fecha de registro', formatDate(inv.registeredAt)),
    fact('Fecha de viabilidad', formatDate(inv.viabilityAt)),
    fact('Tiempo desde la viabilidad', formatYears(yearsSince(inv.viabilityAt, now))),
    fact('Primer devengado', formatMonth(inv.firstAccrualMonth)),
    fact('Último devengado', formatMonth(inv.lastAccrualMonth)),
    fact('Devengado acumulado', formatSoles(inv.accruedTotal)),
    fact('Beneficiarios', formatInteger(inv.beneficiaries)),
    fact('Región', inv.departmentCode === null ? regionLabel(null) : (inv.departmentName ?? DASH)),
    ...optional('Provincia', inv.province),
    ...optional('Distrito', inv.district),
  ];

  const breakpoint = useBreakpoint();
  const wide = isWide(breakpoint);
  /** Desktop: figures on the left, facts on the right. Tablet: one wider column. */
  const columns = breakpoint === 'desktop';
  const wideContent = wide
    ? [
        styles.contentWide,
        {
          maxWidth: columns ? LAYOUT_MAX_WIDTH : TABLET_DETAIL_WIDTH,
          paddingHorizontal: gutterFor(breakpoint) - space.lg,
        },
      ]
    : null;

  const main = (
    <>
      <View style={styles.head}>
        <View style={styles.identity}>
          {tag ? <LevelTag tag={tag} /> : null}
          <HintedLabel term="cui">
            <MonoText bold size={11} muted>{`CUI ${inv.cui}`}</MonoText>
          </HintedLabel>
        </View>
        <DisplayText size={columns ? 40 : 30} accessibilityRole="header" style={columns ? styles.nameWide : styles.name}>
          {inv.name ?? 'Sin nombre'}
        </DisplayText>
        <View style={styles.actions}>
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
          {onOpenMap && inv.coordinates ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Ver en el mapa"
              onPress={onOpenMap}
              style={({ pressed }) => [styles.shareButton, pressed && styles.shareButtonPressed]}>
              <MonoText bold size={13}>
                VER EN EL MAPA
              </MonoText>
            </Pressable>
          ) : null}
        </View>
      </View>

      {paralyzed}

      <View style={styles.costs}>
        <View style={styles.costRow}>
          <HintedLabel term="monto-viable">
            <MonoText size={11} muted>
              APROBADO (MONTO VIABLE)
            </MonoText>
          </HintedLabel>
          <MonoText
            testID="viable-amount"
            accessibilityLabel={`Monto viable: ${viable}`}
            size={16}
            style={increased ? styles.struck : undefined}>
            {viable}
          </MonoText>
        </View>
        <View style={styles.costRow}>
          <HintedLabel term="costo-actualizado">
            <MonoText size={11} muted>
              CUESTA HOY (COSTO ACTUALIZADO)
            </MonoText>
          </HintedLabel>
          {invalidCost ? (
            <View style={styles.notice}>
              <HintedLabel term="costo-no-valido">
                <MonoText bold size={14} style={styles.shrink}>
                  {INVALID_COST_NOTICE}
                </MonoText>
              </HintedLabel>
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
            <HintedLabel term="aumento">
              <MonoText size={11} style={styles.increaseLabel}>
                AUMENTO
              </MonoText>
            </HintedLabel>
            <MonoText bold size={15}>
              {`${formatSignedSoles(inv.costIncrease)} · ${formatSignedPercent(inv.costIncreasePct)}`}
            </MonoText>
          </View>
        )}
      </View>

      {invalidCost ? null : (
        <View style={styles.progress}>
          <HintedLabel term="gastado">
            <MonoText bold size={12}>{`GASTADO ${formatProgress(inv.executionProgress)} DEL COSTO`}</MonoText>
          </HintedLabel>
          <HazardProgressBar
            ratio={inv.executionProgress}
            overspend={spentOverUpdatedCost(inv)}
            anomaly={inv.spentAnomaly}
          />
          {inv.spentAnomaly ? (
            <HintedLabel term="dato-inusual">
              <MonoText size={11} muted>
                Qué es un dato inusual
              </MonoText>
            </HintedLabel>
          ) : null}
          {stalled ? (
            <View style={[styles.hinted, styles.stalled]}>
              <MonoText bold size={12} style={styles.shrink}>
                {stalledSinceSentence(stalled)}
              </MonoText>
              <TermHint term="sin-gasto-reciente" />
            </View>
          ) : null}
        </View>
      )}

      {inv.physicalProgress !== null ? <PhysicalProgress percent={inv.physicalProgress} /> : null}

      {inv.closure && isClosed(inv) ? <ClosureSection closure={inv.closure} grid={wide} /> : null}

      {costHistory}
    </>
  );
  const factList = (
    <View testID="detail-facts" style={[styles.facts, wide && styles.factsGrid, columns && styles.factsSide]}>
      {facts.map((item) => (
        <Fact key={item.label} {...item} grid={wide} />
      ))}
    </View>
  );
  const sourceNote = (
    <MonoText size={11} muted style={styles.source}>
      {`Fuente: ${sourceNameOf(inv.dataSource)}.${
        inv.sourceUpdatedAt ? ` Último cambio en los datos del MEF: ${formatDate(inv.sourceUpdatedAt)}.` : ''
      }`}
    </MonoText>
  );

  if (columns) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, wideContent]}>
        <View testID="detail-columns" style={styles.columns}>
          <View testID="detail-main" style={styles.mainColumn}>
            {main}
          </View>
          <View style={styles.sideColumn}>
            {factList}
            {sourceNote}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, wideContent]}>
      {main}
      {factList}
      {sourceNote}
    </ScrollView>
  );
}

/** Tablet: one column, wider than the phone one, with the facts in two columns. */
const TABLET_DETAIL_WIDTH = 880;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  content: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', paddingBottom: space.xl },
  head: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: 6 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hinted: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  shrink: { flexShrink: 1 },
  physical: { marginTop: space.lg, marginHorizontal: space.lg, gap: space.sm },
  physicalTrack: { height: 12, borderWidth: rule, borderColor: colors.ink, backgroundColor: colors.concrete },
  physicalFill: { height: '100%', backgroundColor: colors.ink },
  name: { lineHeight: 30 },
  nameWide: { lineHeight: 38 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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
  contentWide: { paddingTop: space.sm },
  columns: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { flex: 7 },
  sideColumn: { flex: 5, paddingTop: space.lg },
  /** Definition grid: two facts per row. */
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 0 },
  factsSide: { marginTop: 0, borderBottomWidth: rule, borderBottomColor: colors.ink },
  factGrid: { flexBasis: '50%', flexGrow: 0, paddingRight: space.md },
  fact: {
    borderTopWidth: rule,
    borderTopColor: colors.ink,
    paddingVertical: space.sm + 2,
    gap: 2,
  },
  factLabel: { letterSpacing: 0.5 },
  source: { marginTop: space.lg, marginHorizontal: space.lg },
  closure: { marginTop: space.lg, marginHorizontal: space.lg, gap: space.sm },
});
