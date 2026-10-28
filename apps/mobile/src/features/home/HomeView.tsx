import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { FitDisplayText } from '@/shared/ui/FitDisplayText';
import { HazardProgressBar } from '@/shared/ui/HazardProgressBar';
import { LevelTag } from '@/shared/ui/LevelTag';
import { RankingRow } from '@/shared/ui/RankingRow';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

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
  regions,
  recentIncreases,
  stalled,
  footer,
}: Props) {
  const compare =
    !national && onPressCompare ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Comparar con otra región"
        onPress={onPressCompare}
        style={({ pressed }) => [styles.compare, pressed && styles.comparePressed]}>
        <DisplayText weight={900} size={20}>
          Comparar con otra región →
        </DisplayText>
      </Pressable>
    ) : null;

  const blocks = national ? (
    <>
      {regions}
      {stalled}
      {recentIncreases}
    </>
  ) : (
    <>
      {recentIncreases}
      {stalled}
    </>
  );

  if (!hero) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <StateMessage
          kind="empty"
          message={`No hay proyectos con aumento de costo ${national ? 'en el país' : 'en esta región'}.`}
        />
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver detalle: ${name}`}
        onPress={() => onPressInvestment(hero.cui)}
        style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}>
        <MonoText bold size={11} muted>
          {national ? 'EL MAYOR AUMENTO DEL PAÍS' : 'EL MAYOR AUMENTO DE LA REGIÓN'}
        </MonoText>
        <DisplayText size={34} numberOfLines={3} style={styles.heroName}>
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
            maxSize={136}
            horizontalInset={HERO_FIGURE_INSET}
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

      {ranking.length > 0 ? (
        <View style={styles.ranking}>
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
      ) : null}

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
});
