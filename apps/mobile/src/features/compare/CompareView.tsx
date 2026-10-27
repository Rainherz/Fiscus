import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Investment } from '@/features/investments/domain/investment';
import { formatSignedPercent, formatSignedSoles } from '@/shared/format';
import { colors, maxContentWidth, minTouch, rule, space } from '@/shared/theme/tokens';
import { BackHeader } from '@/shared/ui/BackHeader';
import { StateMessage } from '@/shared/ui/StateMessage';
import { BodyText, DisplayText, MonoText } from '@/shared/ui/typography';

import { departmentName } from '../department/departments';
import type { RegionComparison } from '../investments/domain/regionComparison';
import { REGIONS_HEADER_NOTE } from '../regions/regionPresentation';
import { compareSections, type MetricRow } from './comparePresentation';
import type { RegionPair } from './compareSelection';
import { MirroredBars, SIDE_FILL } from './MirroredBars';
import { RegionChoiceList } from './RegionChoiceList';

export type Side = 'a' | 'b';

export type BiggestIncreaseState =
  | { status: 'pending' }
  | { status: 'error' }
  | { status: 'success'; investment: Investment | null };

interface Props {
  /** Null while the default regions are being chosen. */
  pair: RegionPair | null;
  /** Status of the `region_comparison` read. */
  status: 'pending' | 'error' | 'success';
  regions: RegionComparison[];
  biggest: Record<Side, BiggestIncreaseState>;
  onSelect: (side: Side, code: number) => void;
  onSwap: () => void;
  onRetry: () => void;
  onBack: () => void;
  onPressInvestment: (cui: string) => void;
  topInset?: number;
  bottomInset?: number;
}

const SIDE_TITLE: Record<Side, string> = { a: 'Primera región', b: 'Segunda región' };

/** "Comparar regiones": two departments side by side, metric by metric. */
export function CompareView({
  pair,
  status,
  regions,
  biggest,
  onSelect,
  onSwap,
  onRetry,
  onBack,
  onPressInvestment,
  topInset = 0,
  bottomInset = 0,
}: Props) {
  const [picking, setPicking] = useState<Side | null>(null);

  if (picking && pair) {
    return (
      <RegionChoiceList
        title={SIDE_TITLE[picking]}
        regions={status === 'success' ? regions : []}
        selected={pair[picking]}
        onPick={(code) => {
          setPicking(null);
          onSelect(picking, code);
        }}
        onClose={() => setPicking(null)}
        topInset={topInset}
        bottomInset={bottomInset}
      />
    );
  }

  const rowOf = (code: number) => regions.find((region) => region.departmentCode === code) ?? null;

  return (
    <View style={styles.screen}>
      <BackHeader topInset={topInset} onBack={onBack} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + space.xl }]}
        stickyHeaderIndices={pair ? [1] : undefined}>
        <View style={styles.intro}>
          <MonoText bold size={11} muted>
            DOS REGIONES LADO A LADO
          </MonoText>
          <DisplayText weight={900} size={30} accessibilityRole="header">
            Comparar regiones
          </DisplayText>
        </View>
        {pair ? (
          <Selectors pair={pair} onOpen={setPicking} onSwap={onSwap} />
        ) : (
          <StateMessage kind="loading" />
        )}
        {pair ? (
          pair.a === pair.b ? (
            <StateMessage kind="empty" message="Elige dos regiones distintas." />
          ) : status === 'pending' ? (
            <StateMessage kind="loading" />
          ) : status === 'error' ? (
            <StateMessage kind="error" message="No se pudieron cargar las regiones." onRetry={onRetry} />
          ) : (
            <>
              <MissingData codes={[pair.a, pair.b].filter((code) => rowOf(code) === null)} />
              <MetricTable pair={pair} a={rowOf(pair.a)} b={rowOf(pair.b)} />
              <BiggestIncreases pair={pair} biggest={biggest} onPress={onPressInvestment} />
            </>
          )
        ) : null}
        <MonoText size={11} muted style={styles.footnote}>
          {REGIONS_HEADER_NOTE}
        </MonoText>
      </ScrollView>
    </View>
  );
}

function Swatch({ side }: { side: Side }) {
  return <View style={[styles.swatch, SIDE_FILL[side]]} />;
}

function Selectors({ pair, onOpen, onSwap }: { pair: RegionPair; onOpen: (side: Side) => void; onSwap: () => void }) {
  const selector = (side: Side) => {
    const name = departmentName(pair[side]);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${SIDE_TITLE[side]}: ${name}. Cambiar`}
        onPress={() => onOpen(side)}
        style={({ pressed }) => [styles.selector, side === 'b' && styles.selectorB, pressed && styles.pressed]}>
        <Swatch side={side} />
        <DisplayText size={20} numberOfLines={2} style={[styles.selectorText, side === 'b' && styles.textEnd]}>
          {`${name.toUpperCase()} ▾`}
        </DisplayText>
      </Pressable>
    );
  };
  return (
    <View style={styles.selectors}>
      {selector('a')}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Intercambiar regiones"
        onPress={onSwap}
        style={({ pressed }) => [styles.swap, pressed && styles.pressed]}>
        <MonoText bold size={18}>
          ⇄
        </MonoText>
      </Pressable>
      {selector('b')}
    </View>
  );
}

function MissingData({ codes }: { codes: number[] }) {
  if (codes.length === 0) return null;
  return (
    <MonoText size={12} style={styles.missing}>
      {`Sin datos para ${codes.map(departmentName).join(' ni ')}.`}
    </MonoText>
  );
}

function MetricTable({
  pair,
  a,
  b,
}: {
  pair: RegionPair;
  a: RegionComparison | null;
  b: RegionComparison | null;
}) {
  const nameA = departmentName(pair.a);
  const nameB = departmentName(pair.b);
  return (
    <View>
      {compareSections(a, b).map((section) => (
        <View key={section.title} style={styles.section}>
          <DisplayText weight={900} size={22} accessibilityRole="header">
            {section.title}
          </DisplayText>
          {section.note ? (
            <MonoText size={11} muted style={styles.sectionNote}>
              {section.note}
            </MonoText>
          ) : null}
          {section.rows.map((row) => (
            <MetricLine key={row.key} row={row} nameA={nameA} nameB={nameB} />
          ))}
        </View>
      ))}
    </View>
  );
}

function MetricLine({ row, nameA, nameB }: { row: MetricRow; nameA: string; nameB: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${row.label}: ${nameA} ${row.a.text}; ${nameB} ${row.b.text}`}
      style={styles.metric}>
      <MonoText bold size={12} style={styles.metricLabel}>
        {row.label}
      </MonoText>
      <View style={styles.values}>
        <MonoText bold size={15}>
          {row.a.text}
        </MonoText>
        <MonoText bold size={15} style={styles.textEnd}>
          {row.b.text}
        </MonoText>
      </View>
      <MirroredBars a={row.a.value} b={row.b.value} />
    </View>
  );
}

function BiggestIncreases({
  pair,
  biggest,
  onPress,
}: {
  pair: RegionPair;
  biggest: Record<Side, BiggestIncreaseState>;
  onPress: (cui: string) => void;
}) {
  return (
    <View style={styles.section}>
      <DisplayText weight={900} size={22} accessibilityRole="header">
        EL MAYOR AUMENTO EN CADA REGIÓN
      </DisplayText>
      <View style={styles.cards}>
        {(['a', 'b'] as const).map((side) => (
          <BiggestCard key={side} side={side} code={pair[side]} state={biggest[side]} onPress={onPress} />
        ))}
      </View>
    </View>
  );
}

function BiggestCard({
  side,
  code,
  state,
  onPress,
}: {
  side: Side;
  code: number;
  state: BiggestIncreaseState;
  onPress: (cui: string) => void;
}) {
  const region = departmentName(code);
  const heading = (
    <View style={styles.cardHeading}>
      <Swatch side={side} />
      <MonoText bold size={11}>
        {region.toUpperCase()}
      </MonoText>
    </View>
  );
  if (state.status !== 'success' || state.investment === null) {
    return (
      <View style={styles.card}>
        {heading}
        <BodyText muted size={14}>
          {state.status === 'pending'
            ? 'Cargando…'
            : state.status === 'error'
              ? 'No se pudo cargar.'
              : 'Ningún proyecto con aumento de costo.'}
        </BodyText>
      </View>
    );
  }
  const investment = state.investment;
  const name = investment.name ?? 'Sin nombre';
  const amount = formatSignedSoles(investment.costIncrease);
  const pct = formatSignedPercent(investment.costIncreasePct);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mayor aumento en ${region}: ${name}, ${amount}, ${pct}`}
      onPress={() => onPress(investment.cui)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {heading}
      <BodyText weight={600} size={15} numberOfLines={3}>
        {name}
      </BodyText>
      <MonoText bold size={14}>{`${amount} · ${pct}`}</MonoText>
      <MonoText size={11} muted>
        Ver detalle →
      </MonoText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  intro: { paddingTop: space.lg, paddingHorizontal: space.lg, paddingBottom: space.md, gap: 4 },
  selectors: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.concrete,
    borderBottomWidth: rule,
    borderBottomColor: colors.ink,
  },
  selector: {
    flex: 1,
    minHeight: minTouch + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    borderWidth: rule,
    borderColor: colors.ink,
  },
  selectorB: { flexDirection: 'row-reverse' },
  selectorText: { flexShrink: 1, lineHeight: 22 },
  textEnd: { textAlign: 'right' },
  swap: {
    width: minTouch,
    minHeight: minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: rule,
    borderColor: colors.ink,
    backgroundColor: colors.signal,
  },
  pressed: { opacity: 0.7 },
  swatch: { width: 14, height: 14 },
  missing: { paddingHorizontal: space.lg, paddingTop: space.md },
  section: { marginTop: space.xl, paddingHorizontal: space.lg },
  sectionNote: { marginTop: 2 },
  metric: { paddingTop: space.sm, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: colors.muted, gap: 2 },
  metricLabel: { textAlign: 'center' },
  values: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  card: {
    flexGrow: 1,
    flexBasis: 240,
    gap: 6,
    padding: space.md,
    borderWidth: rule,
    borderColor: colors.ink,
  },
  cardPressed: { backgroundColor: colors.concretePressed },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footnote: { marginTop: space.xl, paddingHorizontal: space.lg },
});
