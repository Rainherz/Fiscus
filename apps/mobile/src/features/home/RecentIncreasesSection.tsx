import { Pressable, StyleSheet, View } from 'react-native';

import { departmentName } from '@/features/department/departments';
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

const EMPTY =
  'Aún no hay cambios registrados. Fiscus revisa los costos todos los días desde el ' +
  `${formatDate(COST_HISTORY_START)}.`;

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
  const region = national && item.departmentCode !== null ? item.departmentCode : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        region !== null ? `${name}, ${departmentName(region)}, ${date}, ${delta}` : `${name}, ${date}, ${delta}`
      }
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.main}>
        <BodyText weight={600} size={14} numberOfLines={2}>
          {name}
        </BodyText>
        <MonoText size={11} muted>
          {region !== null ? withRegion(region, date) : date}
        </MonoText>
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
        <View style={styles.empty}>
          <MonoText size={12}>{EMPTY}</MonoText>
        </View>
      ) : (
        state.items.map((item) => (
          <IncreaseRow key={item.id} item={item} national={national} onPress={() => onPressInvestment(item.cui)} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  empty: {
    borderTopWidth: rule,
    borderTopColor: colors.ink,
    borderBottomWidth: rule,
    borderBottomColor: colors.ink,
    paddingVertical: space.md,
  },
});
