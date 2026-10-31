import { Pressable, StyleSheet, View } from 'react-native';

import { FilteredEmptyState } from '@/features/department/FilteredEmptyState';
import type { StalledInvestment } from '@/features/investments/domain/stalled';
import { colors, minTouch, space } from '@/shared/theme/tokens';
import { levelTag } from '@/features/government-level/levelPresentation';
import { RankingRow } from '@/shared/ui/RankingRow';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import { STALLED_EMPTY, STALLED_TITLE, stalledCountText, stalledRowDetail } from './stalledPresentation';

export type StalledPreviewState =
  | { status: 'pending' }
  | { status: 'error'; onRetry: () => void }
  | { status: 'success'; total: number; items: StalledInvestment[] };

interface Props {
  state: StalledPreviewState;
  /** Counting all of Peru: rows show their region. */
  national?: boolean;
  onPressInvestment: (cui: string) => void;
  onPressSeeAll: () => void;
}

/** "Sin gasto reciente" on the home screen: count for the scope and the first rows. */
export function StalledPreviewSection({ state, national = false, onPressInvestment, onPressSeeAll }: Props) {
  return (
    <View style={styles.section}>
      <DisplayText weight={900} size={22} accessibilityRole="header" style={styles.title}>
        {STALLED_TITLE}
      </DisplayText>
      {state.status === 'pending' ? (
        <StateMessage kind="loading" />
      ) : state.status === 'error' ? (
        <StateMessage
          kind="error"
          message="No se pudieron cargar los proyectos sin gasto reciente."
          onRetry={state.onRetry}
        />
      ) : state.total === 0 ? (
        <FilteredEmptyState what={STALLED_EMPTY} variant="ruled" />
      ) : (
        <>
          <MonoText bold size={12} style={styles.count}>
            {stalledCountText(state.total, { national })}
          </MonoText>
          {state.items.map((item, index) => (
            <RankingRow
              key={item.cui}
              rank={index + 1}
              name={item.name}
              detail={stalledRowDetail(item, { national })}
              tag={levelTag(item.governmentLevel)}
              onPress={() => onPressInvestment(item.cui)}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver todos los proyectos sin gasto reciente"
            onPress={onPressSeeAll}
            style={({ pressed }) => [styles.seeAll, pressed && styles.seeAllPressed]}>
            <DisplayText size={18}>Ver todos →</DisplayText>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl, paddingHorizontal: space.lg },
  title: { marginBottom: 2 },
  count: { marginBottom: 6 },
  seeAll: {
    minHeight: minTouch,
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: colors.ink,
  },
  seeAllPressed: { backgroundColor: colors.concretePressed },
});
