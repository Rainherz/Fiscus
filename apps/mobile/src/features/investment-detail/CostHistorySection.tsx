import { StyleSheet, View } from 'react-native';

import {
  COST_HISTORY_START,
  viableAmountChange,
  type CostChange,
} from '@/features/investments/domain/costChange';
import { formatDate, formatSignedSolesCompact, formatSoles } from '@/shared/format';
import { colors, rule, space } from '@/shared/theme/tokens';
import { TermHint } from '@/features/glossary/TermHint';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

export type CostHistoryState =
  | { status: 'pending' }
  | { status: 'error'; onRetry: () => void }
  | { status: 'success'; changes: CostChange[] };

interface Props {
  state: CostHistoryState;
}

const NOTE =
  `Fiscus registra cambios desde el ${formatDate(COST_HISTORY_START)}. ` +
  'El MEF no publica el historial anterior.';

const START_LABEL: Record<Exclude<CostChange['kind'], 'changed'>, string> = {
  baseline: 'Inicio del registro',
  first_seen: 'Registrado por primera vez',
};

function viableLine(change: CostChange): string | null {
  const viable = viableAmountChange(change);
  return viable ? `Monto viable: ${formatSoles(viable.from)} → ${formatSoles(viable.to)}` : null;
}

/** The delta is omitted when only the viable amount changed or the previous cost is unknown. */
function costDelta(change: CostChange): string | null {
  const delta = change.updatedCostDelta;
  return delta === null || delta === 0 ? null : formatSignedSolesCompact(delta);
}

function HistoryRow({ change }: { change: CostChange }) {
  const date = formatDate(change.observedAt);

  if (change.kind !== 'changed') {
    const text = `${START_LABEL[change.kind]}: ${formatSoles(change.updatedCost)}`;
    return (
      <View accessible accessibilityLabel={`${date}: ${text}`} style={styles.row}>
        <MonoText bold size={11} muted>
          {date}
        </MonoText>
        <MonoText size={14}>{text}</MonoText>
      </View>
    );
  }

  const updated = formatSoles(change.updatedCost);
  const delta = costDelta(change);
  const viable = viableLine(change);
  const label =
    `${date}: costo actualizado ${updated}` + (delta ? `, ${delta}` : '') + (viable ? `. ${viable}` : '');
  const increased = (change.updatedCostDelta ?? 0) > 0;

  return (
    <View accessible accessibilityLabel={label} style={styles.row}>
      <MonoText bold size={11} muted>
        {date}
      </MonoText>
      <View style={styles.figures}>
        <MonoText bold size={18}>
          {updated}
        </MonoText>
        {delta ? (
          <MonoText bold size={13} style={[styles.delta, increased && styles.deltaUp]}>
            {delta}
          </MonoText>
        ) : null}
      </View>
      {viable ? (
        <MonoText size={12} muted>
          {viable}
        </MonoText>
      ) : null}
    </View>
  );
}

/** "Historial del costo": the values Fiscus recorded for one investment, oldest first. */
export function CostHistorySection({ state }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <DisplayText weight={900} size={22} accessibilityRole="header" style={styles.title}>
          HISTORIAL DEL COSTO
        </DisplayText>
        <TermHint term="historial" />
      </View>
      {state.status === 'pending' ? (
        <StateMessage kind="loading" message="Cargando historial…" />
      ) : state.status === 'error' ? (
        <StateMessage kind="error" message="No se pudo cargar el historial del costo." onRetry={state.onRetry} />
      ) : state.changes.length === 0 ? (
        <View style={styles.row}>
          <MonoText size={13}>Aún no hay registros del costo de este proyecto.</MonoText>
        </View>
      ) : (
        state.changes.map((change) => <HistoryRow key={change.id} change={change} />)
      )}
      <MonoText size={11} muted style={styles.note}>
        {NOTE}
      </MonoText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl, marginHorizontal: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 6 },
  title: { flexShrink: 1 },
  row: {
    borderTopWidth: rule,
    borderTopColor: colors.ink,
    paddingVertical: space.sm + 2,
    gap: space.xs,
  },
  figures: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  delta: {
    borderWidth: rule,
    borderColor: colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  deltaUp: { backgroundColor: colors.signal },
  note: {
    borderTopWidth: rule,
    borderTopColor: colors.ink,
    paddingTop: space.sm,
  },
});
