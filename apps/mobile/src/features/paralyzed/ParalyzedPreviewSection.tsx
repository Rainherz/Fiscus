import { Pressable, StyleSheet, View } from 'react-native';

import { FilteredEmptyState } from '@/features/department/FilteredEmptyState';
import { TermHint } from '@/features/glossary/TermHint';
import { projectTag } from '@/features/government-level/levelPresentation';
import type { ParalyzedEdition, ParalyzedInvestment } from '@/features/investments/domain/paralyzed';
import { colors, minTouch, space } from '@/shared/theme/tokens';
import { RankingRow } from '@/shared/ui/RankingRow';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import {
  PARALYZED_EMPTY,
  PARALYZED_LIST_TITLE,
  paralyzedCountText,
  paralyzedEditionLine,
  paralyzedRowDetail,
} from './paralyzedPresentation';

export type ParalyzedPreviewState =
  | { status: 'pending' }
  | { status: 'error'; onRetry: () => void }
  | { status: 'success'; total: number; items: ParalyzedInvestment[]; edition: ParalyzedEdition | null };

interface Props {
  state: ParalyzedPreviewState;
  now: Date;
  /** Counting all of Peru: rows show their region. */
  national?: boolean;
  onPressInvestment: (cui: string) => void;
  onPressSeeAll: () => void;
}

/**
 * "Paralizadas según la Contraloría" on the home screen: count for the scope, the first rows by
 * remaining balance and the edition. Nothing before the first edition is ingested.
 */
export function ParalyzedPreviewSection({ state, now, national = false, onPressInvestment, onPressSeeAll }: Props) {
  if (state.status === 'success' && state.edition === null) return null;
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <DisplayText weight={900} size={22} accessibilityRole="header" style={styles.title}>
          {PARALYZED_LIST_TITLE}
        </DisplayText>
        <TermHint term="obra-paralizada" />
      </View>
      {state.status === 'pending' ? (
        <StateMessage kind="loading" />
      ) : state.status === 'error' ? (
        <StateMessage kind="error" message="No se pudieron cargar las obras paralizadas." onRetry={state.onRetry} />
      ) : (
        <>
          {state.total === 0 ? (
            <FilteredEmptyState what={PARALYZED_EMPTY} list="paralyzed" variant="ruled" />
          ) : (
            <>
              <MonoText bold size={12} style={styles.count}>
                {paralyzedCountText(state.total, { national })}
              </MonoText>
              {state.items.map((item, index) => (
                <RankingRow
                  key={item.cui}
                  rank={index + 1}
                  name={item.name}
                  detail={paralyzedRowDetail(item, { national })}
                  tag={projectTag(item)}
                  onPress={() => onPressInvestment(item.cui)}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver todas las obras paralizadas según la Contraloría"
                onPress={onPressSeeAll}
                style={({ pressed }) => [styles.seeAll, pressed && styles.seeAllPressed]}>
                <DisplayText size={18}>Ver todas →</DisplayText>
              </Pressable>
            </>
          )}
          {state.edition ? (
            <MonoText size={11} muted style={styles.edition}>
              {`${paralyzedEditionLine(state.edition, now)}. Fuente: Contraloría General de la República.`}
            </MonoText>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl, paddingHorizontal: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 2 },
  title: { flexShrink: 1 },
  count: { marginBottom: 6 },
  seeAll: {
    minHeight: minTouch,
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: colors.ink,
  },
  seeAllPressed: { backgroundColor: colors.concretePressed },
  edition: { marginTop: space.xs },
});
