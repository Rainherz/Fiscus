import { Pressable, StyleSheet, View } from 'react-native';

import { regionLabel } from '@/features/department/departments';
import { FilteredEmptyState } from '@/features/department/FilteredEmptyState';
import { levelTag } from '@/features/government-level/levelPresentation';
import { LevelTag } from '@/shared/ui/LevelTag';
import { withRegion } from '@/features/department/scope';
import { COST_HISTORY_START, type RecentCostIncrease } from '@/features/investments/domain/costChange';
import { formatDate, formatSignedSolesCompact } from '@/shared/format';
import { colors, minTouch, rule, space } from '@/shared/theme/tokens';
import { StateMessage } from '@/shared/ui/StateMessage';
import { BodyText, DisplayText, MonoText } from '@/shared/ui/typography';

export type RecentIncreasesState =
  | { status: 'pending' }
  | { status: 'error'; onRetry: () => void }
  | { status: 'success'; items: RecentCostIncrease[] };

interface Props {
  state: RecentIncreasesState;
  /** Listing all of Peru: rows show their region. */
  national?: boolean;
  onPressInvestment: (cui: string) => void;
}

const EMPTY = 'Aún no hay cambios registrados';
const EMPTY_HINT = `Fiscus revisa los costos todos los días desde el ${formatDate(COST_HISTORY_START)}.`;

function IncreaseRow({
  item,
  national,
  onPress,
}: {
  item: RecentCostIncrease;
  national: boolean;
  onPress: () => void;
}) {
  const name = item.name ?? 'Sin nombre';
  const date = formatDate(item.observedAt);
  const delta = formatSignedSolesCompact(item.updatedCostDelta);
  const tag = levelTag(item.governmentLevel);
  const announced = [name, tag?.label, national ? regionLabel(item.departmentCode) : null, date, delta];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={announced.filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.main}>
        <BodyText weight={600} size={14} numberOfLines={2}>
          {name}
        </BodyText>
        <View style={styles.detail}>
          {tag ? <LevelTag tag={tag} /> : null}
          <MonoText size={11} muted style={styles.detailText}>
            {national ? withRegion(item.departmentCode, date) : date}
          </MonoText>
        </View>
      </View>
      <MonoText bold size={13} style={styles.delta}>
        {delta}
      </MonoText>
    </Pressable>
  );
}

/** "Aumentos recientes": recorded increases of the updated cost in the scope, newest first. */
export function RecentIncreasesSection({ state, national = false, onPressInvestment }: Props) {
  return (
    <View style={styles.section}>
      <DisplayText weight={900} size={22} accessibilityRole="header" style={styles.title}>
        AUMENTOS RECIENTES
      </DisplayText>
      {state.status === 'pending' ? (
        <StateMessage kind="loading" />
      ) : state.status === 'error' ? (
        <StateMessage
          kind="error"
          message="No se pudieron cargar los aumentos recientes."
          onRetry={state.onRetry}
        />
      ) : state.items.length === 0 ? (
        <FilteredEmptyState what={EMPTY} hint={EMPTY_HINT} variant="ruled" />
      ) : (
        state.items.map((item) => (
          <IncreaseRow key={item.id} item={item} national={national} onPress={() => onPressInvestment(item.cui)} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs + 2 },
  detailText: { flexShrink: 1 },
  section: { marginTop: space.xl, paddingHorizontal: space.lg },
  title: { marginBottom: 6 },
  row: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    paddingVertical: 9,
    borderTopWidth: rule,
    borderTopColor: colors.ink,
  },
  rowPressed: { backgroundColor: colors.concretePressed },
  main: { flex: 1, gap: 2 },
  delta: {
    borderWidth: rule,
    borderColor: colors.ink,
    backgroundColor: colors.signal,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
});
