import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { regionLabel } from '@/features/department/departments';
import { levelTag } from '@/features/government-level/levelPresentation';
import { spentOverUpdatedCost, type Investment } from '@/features/investments/domain/investment';
import {
  formatProgress,
  formatSignedPercent,
  formatSignedSoles,
  formatSoles,
  formatYear,
  formatYears,
  yearsSince,
} from '@/shared/format';
import { colors, maxContentWidth, minTouch, rule, space } from '@/shared/theme/tokens';
import { isWide, LAYOUT_MAX_WIDTH } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
import { FitDisplayText } from '@/shared/ui/FitDisplayText';
import { HazardProgressBar } from '@/shared/ui/HazardProgressBar';
import { LevelTag } from '@/shared/ui/LevelTag';
import { RankingRow } from '@/shared/ui/RankingRow';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import { HERO_PARTS, heroFigureWidth, homeColumnPadding, homeGridColumns } from './homeLayout';

interface Props {
  /** The project with the largest absolute cost increase in the scope. */
  hero: Investment | null;
  /** Following projects by absolute increase (rank 2 onward). */
  ranking: Investment[];
  now: Date;
  /** All of Peru: country wording, the region of each project, and the regions block. */
  national?: boolean;
  onPressInvestment: (cui: string) => void;
  onPressSeeAll: () => void;
  /** Region home only: opens the comparison with this region first. */
  onPressCompare?: () => void;
  /** Opens the map of the scope. */
  onPressMap?: () => void;
  /** "Regiones con más aumentos", national only, shown after the ranking. */
  regions?: ReactNode;
  /** "Aumentos recientes": after the ranking (region) or last (national). */
  recentIncreases?: ReactNode;
  /** "Sin gasto reciente": after the recent increases (region) or the regions block (national). */
  stalled?: ReactNode;
  footer?: ReactNode;
}

export function HomeView({
  hero,
  ranking,
  now,
  national = false,
  onPressInvestment,
  onPressSeeAll,
  onPressCompare,
  onPressMap,
  regions,
  recentIncreases,
  stalled,
  footer,
}: Props) {
  const breakpoint = useBreakpoint();
  const { width: windowWidth } = useWindowDimensions();
  const wide = isWide(breakpoint);
  const ctaStyle = wide ? styles.cta : styles.compare;

  const compare =
    !national && onPressCompare ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Comparar con otra región"
        onPress={onPressCompare}
        style={({ pressed }) => [ctaStyle, pressed && styles.comparePressed]}>
        <DisplayText weight={900} size={20}>
          Comparar con otra región →
        </DisplayText>
      </Pressable>
    ) : null;

  const mapLink = onPressMap ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Ver en el mapa"
      onPress={onPressMap}
      style={({ pressed }) => [ctaStyle, pressed && styles.comparePressed]}>
      <DisplayText weight={900} size={20}>
        Ver en el mapa →
      </DisplayText>
    </Pressable>
  ) : null;

  const blockList = (national ? [regions, stalled, recentIncreases] : [recentIncreases, stalled]).filter(
    (block): block is NonNullable<ReactNode> => block !== undefined && block !== null && block !== false,
  );
  const blocks = <>{blockList}</>;

  const columnStyle = wide
    ? [styles.content, styles.wideColumn, { paddingHorizontal: homeColumnPadding(breakpoint) }]
    : styles.content;
  const columns = homeGridColumns(breakpoint);
  const grid = (
    <>
      <View style={styles.gridRule} />
      <View testID="home-grid" style={styles.grid}>
        {blockList.map((block, index) => (
          <View key={index} testID="home-grid-cell" style={[styles.cell, { flexBasis: `${100 / columns}%` }]}>
            {block}
          </View>
        ))}
      </View>
    </>
  );
  const ctas =
    wide && (mapLink || compare) ? (
      <View style={styles.ctaRow}>
        {mapLink}
        {compare}
      </View>
    ) : null;

  if (!hero) {
    const empty = (
      <StateMessage
        kind="empty"
        message={`No hay proyectos con aumento de costo ${national ? 'en el país' : 'en esta región'}.`}
      />
    );
    if (wide) {
      return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.wideScroll}>
          <View testID="home-column" style={columnStyle}>
            {empty}
            {ctas}
            {grid}
          </View>
          {footer}
        </ScrollView>
      );
    }
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {empty}
        {mapLink}
        {compare}
        {blocks}
        {footer}
      </ScrollView>
    );
  }

  const years = yearsSince(hero.viabilityAt, now);
  const approvedYear = hero.viabilityAt ? ` aprobado en ${formatYear(hero.viabilityAt)}` : ' aprobado';
  const name = hero.name ?? 'Sin nombre';
  const heroTag = levelTag(hero.governmentLevel);

  const heroBlock = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver detalle: ${name}`}
        onPress={() => onPressInvestment(hero.cui)}
        style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}>
        <MonoText bold size={11} muted>
          {national ? 'EL MAYOR AUMENTO DEL PAÍS' : 'EL MAYOR AUMENTO DE LA REGIÓN'}
        </MonoText>
        <DisplayText
          size={wide ? 44 : 34}
          numberOfLines={3}
          style={wide ? styles.heroNameWide : styles.heroName}>
          {name}
        </DisplayText>
        {national || heroTag ? (
          <View style={styles.heroPlace}>
            {heroTag ? <LevelTag tag={heroTag} /> : null}
            {national ? (
              <MonoText bold size={12}>
                {regionLabel(hero.departmentCode).toUpperCase()}
              </MonoText>
            ) : null}
          </View>
        ) : null}
        <View style={styles.figure}>
          <FitDisplayText
            text={formatSignedPercent(hero.costIncreasePct)}
            maxSize={wide ? 220 : 136}
            horizontalInset={HERO_FIGURE_INSET}
            estimatedWidth={wide ? heroFigureWidth(windowWidth) : undefined}
          />
        </View>
        <View style={styles.amounts}>
          <Text>
            <MonoText>{formatSoles(hero.viableAmount)}</MonoText>
            <MonoText muted>{approvedYear}</MonoText>
          </Text>
          <Text>
            <MonoText bold>{formatSoles(hero.updatedCost)}</MonoText>
            <MonoText muted>{' cuesta hoy'}</MonoText>
          </Text>
        </View>
      </Pressable>

      <View style={styles.progress}>
        <View style={styles.progressLabels}>
          <MonoText bold size={12}>{`GASTADO ${formatProgress(hero.executionProgress)} DEL COSTO`}</MonoText>
          {years !== null ? (
            <MonoText bold size={12}>{`${formatYears(years).toUpperCase()} EN CURSO`}</MonoText>
          ) : null}
        </View>
        <HazardProgressBar
          ratio={hero.executionProgress}
          overspend={spentOverUpdatedCost(hero)}
          anomaly={hero.spentAnomaly}
        />
      </View>
    </>
  );

  const rankingBlock =
    ranking.length > 0 ? (
      <View style={[styles.ranking, wide && styles.rankingWide]}>
        <DisplayText weight={900} size={22} accessibilityRole="header" style={styles.rankingTitle}>
          RANKING DE AUMENTOS
        </DisplayText>
        {ranking.map((investment, index) => (
          <RankingRow
            key={investment.cui}
            tone="signal"
            rank={index + 2}
            name={investment.name}
            value={formatSignedSoles(investment.costIncrease)}
            detail={national ? regionLabel(investment.departmentCode) : undefined}
            tag={levelTag(investment.governmentLevel)}
            onPress={() => onPressInvestment(investment.cui)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver ranking completo"
          onPress={onPressSeeAll}
          style={({ pressed }) => [styles.seeAll, pressed && styles.seeAllPressed]}>
          <DisplayText size={18}>Ver ranking completo →</DisplayText>
        </Pressable>
      </View>
    ) : null;

  if (wide) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.wideScroll}>
        <View testID="home-column" style={columnStyle}>
          <View testID="home-hero-row" style={styles.heroRow}>
            <View style={styles.heroColumn}>
              {heroBlock}
              {ctas}
            </View>
            {rankingBlock ? <View style={styles.rankingColumn}>{rankingBlock}</View> : null}
          </View>
          {grid}
        </View>
        {footer}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {heroBlock}

      {rankingBlock}

      {mapLink}

      {compare}

      {blocks}

      {footer}
    </ScrollView>
  );
}

/** Hero padding on both sides minus the figure's negative margins (see styles.figure). */
const HERO_FIGURE_INSET = space.lg * 2 - 16;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  content: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', paddingBottom: space.lg },
  hero: { paddingTop: space.lg, paddingHorizontal: space.lg, gap: 6 },
  heroPressed: { backgroundColor: colors.concretePressed },
  heroName: { lineHeight: 32 },
  heroPlace: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  figure: { marginTop: space.sm, marginHorizontal: -8 },
  amounts: { gap: space.xs, paddingTop: 2 },
  progress: { marginTop: space.lg, marginHorizontal: space.lg, gap: space.sm },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  ranking: {
    marginTop: space.xl,
    backgroundColor: colors.signal,
    paddingTop: 14,
    paddingHorizontal: space.lg,
  },
  rankingTitle: { marginBottom: 6 },
  seeAll: {
    minHeight: minTouch,
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: colors.ink,
  },
  seeAllPressed: { backgroundColor: colors.signalPressed },
  compare: {
    marginTop: space.lg,
    marginHorizontal: space.lg,
    minHeight: minTouch + 8,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderWidth: rule,
    borderColor: colors.ink,
  },
  comparePressed: { backgroundColor: colors.concretePressed },
  // Tablet and desktop. Every block keeps its own 20 px padding; the column adds the rest of the gutter.
  wideScroll: { flexGrow: 1 },
  wideColumn: { maxWidth: LAYOUT_MAX_WIDTH, flexGrow: 1, paddingTop: space.md },
  heroRow: { flexDirection: 'row', alignItems: 'stretch' },
  heroColumn: { flex: HERO_PARTS, paddingBottom: space.lg },
  rankingColumn: { flex: 12 - HERO_PARTS, paddingTop: space.lg, paddingHorizontal: space.lg },
  heroNameWide: { lineHeight: 42 },
  rankingWide: { marginTop: 0, borderWidth: rule, borderColor: colors.ink },
  cta: {
    flexGrow: 1,
    minHeight: minTouch + 8,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderWidth: rule,
    borderColor: colors.ink,
  },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: space.lg, marginTop: space.lg, gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  /** Closes the hero row; inset like the blocks' text. */
  gridRule: { height: rule, backgroundColor: colors.ink, marginTop: space.md, marginHorizontal: space.lg },
  cell: { flexGrow: 1, paddingBottom: space.lg },
});
