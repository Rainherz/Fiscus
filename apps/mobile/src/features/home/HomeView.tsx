import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Investment } from '@/features/investments/domain/investment';
import {
  formatProgress,
  formatSignedPercent,
  formatSignedSoles,
  formatSoles,
  formatYear,
  formatYears,
  yearsSince,
} from '@/shared/format';
import { colors, maxContentWidth, minTouch, space } from '@/shared/theme/tokens';
import { FitDisplayText } from '@/shared/ui/FitDisplayText';
import { HazardProgressBar } from '@/shared/ui/HazardProgressBar';
import { RankingRow } from '@/shared/ui/RankingRow';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

interface Props {
  /** The department's project with the largest absolute cost increase. */
  hero: Investment | null;
  /** Following projects by absolute increase (rank 2 onward). */
  ranking: Investment[];
  now: Date;
  onPressInvestment: (cui: string) => void;
  onPressSeeAll: () => void;
  footer?: ReactNode;
}

export function HomeView({ hero, ranking, now, onPressInvestment, onPressSeeAll, footer }: Props) {
  if (!hero) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <StateMessage kind="empty" message="No hay proyectos con aumento de costo en esta región." />
        {footer}
      </ScrollView>
    );
  }

  const years = yearsSince(hero.viabilityAt, now);
  const approvedYear = hero.viabilityAt ? ` aprobado en ${formatYear(hero.viabilityAt)}` : ' aprobado';
  const name = hero.name ?? 'Sin nombre';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver detalle: ${name}`}
        onPress={() => onPressInvestment(hero.cui)}
        style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}>
        <MonoText bold size={11} muted>
          EL MAYOR AUMENTO DE LA REGIÓN
        </MonoText>
        <DisplayText size={34} numberOfLines={3} style={styles.heroName}>
          {name}
        </DisplayText>
        <View style={styles.figure}>
          <FitDisplayText text={formatSignedPercent(hero.costIncreasePct)} maxSize={136} />
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
          <MonoText bold size={12}>{`AVANCE ${formatProgress(hero.executionProgress)}`}</MonoText>
          {years !== null ? (
            <MonoText bold size={12}>{`${formatYears(years).toUpperCase()} EN CURSO`}</MonoText>
          ) : null}
        </View>
        <HazardProgressBar ratio={hero.executionProgress} />
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

      {footer}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  content: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', paddingBottom: space.lg },
  hero: { paddingTop: space.lg, paddingHorizontal: space.lg, gap: 6 },
  heroPressed: { backgroundColor: colors.concretePressed },
  heroName: { lineHeight: 32 },
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
});
