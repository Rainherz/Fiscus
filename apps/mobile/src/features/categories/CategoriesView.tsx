import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import type { FunctionSummary } from '@/features/investments/domain/investment';
import { formatInteger, formatSignedSoles, formatSoles } from '@/shared/format';
import { colors, maxContentWidth, minTouch, rule, space } from '@/shared/theme/tokens';
import { StateMessage } from '@/shared/ui/StateMessage';
import { BodyText, DisplayText, MonoText } from '@/shared/ui/typography';

interface Props {
  summaries: FunctionSummary[];
  status: 'pending' | 'error' | 'success';
  onRetry: () => void;
  onPressCategory: (fn: string | null) => void;
}

export const NO_FUNCTION_LABEL = 'Sin función registrada';

const countLabel = (n: number) => (n === 1 ? '1 proyecto' : `${formatInteger(n)} proyectos`);

function CategoryRow({ summary, onPress }: { summary: FunctionSummary; onPress: () => void }) {
  const label = summary.function ?? NO_FUNCTION_LABEL;
  const count = countLabel(summary.investmentCount);
  const cost = formatSoles(summary.totalUpdatedCost);
  const increase =
    summary.totalCostIncrease !== null && summary.totalCostIncrease !== 0
      ? `${formatSignedSoles(summary.totalCostIncrease)} de aumento`
      : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, count, `costo actual ${cost}`, increase].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.main}>
        <BodyText weight={600} size={15}>
          {label}
        </BodyText>
        <MonoText size={11} muted>
          {count}
        </MonoText>
      </View>
      <View style={styles.figures}>
        <MonoText bold size={13}>
          {cost}
        </MonoText>
        {increase ? (
          <MonoText size={11} muted>
            {increase}
          </MonoText>
        ) : null}
      </View>
    </Pressable>
  );
}

export function CategoriesView({ summaries, status, onRetry, onPressCategory }: Props) {
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={summaries}
      keyExtractor={(item) => item.function ?? '__none__'}
      ListHeaderComponent={
        <View style={styles.header}>
          <DisplayText weight={900} size={26} accessibilityRole="header">
            Categorías
          </DisplayText>
          <MonoText size={11} muted>
            Funciones tal como las publica el MEF. Costo actual total por función.
          </MonoText>
        </View>
      }
      renderItem={({ item }) => (
        <CategoryRow summary={item} onPress={() => onPressCategory(item.function)} />
      )}
      ListEmptyComponent={
        status === 'pending' ? (
          <StateMessage kind="loading" />
        ) : status === 'error' ? (
          <StateMessage kind="error" onRetry={onRetry} />
        ) : (
          <StateMessage kind="empty" message="No hay proyectos registrados en esta región." />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  header: { paddingTop: space.lg, paddingBottom: space.md, gap: space.xs },
  row: {
    minHeight: minTouch,
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.sm + 2,
    borderTopWidth: rule,
    borderTopColor: colors.ink,
  },
  pressed: { backgroundColor: colors.concretePressed },
  main: { flex: 1, gap: 2 },
  figures: { alignItems: 'flex-end', gap: 2 },
});
