import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import type { FunctionSummary } from '@/features/investments/domain/investment';
import { formatInteger, formatSignedSoles, formatSoles } from '@/shared/format';
import { gutterFor, isWide, LAYOUT_MAX_WIDTH, type Breakpoint } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
import { colors, maxContentWidth, minTouch, rule, space } from '@/shared/theme/tokens';
import { StateMessage } from '@/shared/ui/StateMessage';
import { BodyText, DisplayText, MonoText } from '@/shared/ui/typography';

interface Props {
  summaries: FunctionSummary[];
  status: 'pending' | 'error' | 'success';
  /** Summaries of all of Peru. */
  national?: boolean;
  /** Which government levels the totals cover (see levelScopeNote). */
  levelNote?: string;
  onRetry: () => void;
  onPressCategory: (fn: string | null) => void;
}

export const NO_FUNCTION_LABEL = 'Sin función registrada';

const countLabel = (n: number) => (n === 1 ? '1 proyecto' : `${formatInteger(n)} proyectos`);

function describe(summary: FunctionSummary) {
  const label = summary.function ?? NO_FUNCTION_LABEL;
  const count = countLabel(summary.investmentCount);
  const cost = formatSoles(summary.totalUpdatedCost);
  const increase =
    summary.totalCostIncrease !== null && summary.totalCostIncrease !== 0
      ? `${formatSignedSoles(summary.totalCostIncrease)} de aumento`
      : null;
  const accessibilityLabel = [label, count, `costo actual ${cost}`, increase].filter(Boolean).join(', ');
  return { label, count, cost, increase, accessibilityLabel };
}

/** Tablet and desktop: one card per function, the current cost as the figure. */
function CategoryCard({ summary, onPress }: { summary: FunctionSummary; onPress: () => void }) {
  const { label, count, cost, increase, accessibilityLabel } = describe(summary);
  return (
    <Pressable
      testID="category-card"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.card,
        (pressed || hovered) && styles.pressed,
      ]}>
      <View style={styles.cardTop}>
        <BodyText weight={600} size={15} numberOfLines={2}>
          {label}
        </BodyText>
        <MonoText size={11} muted>
          {count}
        </MonoText>
      </View>
      <View style={styles.cardFigures}>
        <MonoText size={11} muted>
          COSTO ACTUAL
        </MonoText>
        <DisplayText weight={900} size={30} numberOfLines={1}>
          {cost}
        </DisplayText>
        {increase ? (
          <MonoText bold size={12} style={styles.cardIncrease}>
            {increase}
          </MonoText>
        ) : null}
      </View>
    </Pressable>
  );
}

const GRID_COLUMNS: Record<Breakpoint, number> = { phone: 1, tablet: 2, desktop: 3 };

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function CategoryRow({ summary, onPress }: { summary: FunctionSummary; onPress: () => void }) {
  const { label, count, cost, increase } = describe(summary);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={describe(summary).accessibilityLabel}
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

export function CategoriesView({ summaries, status, national = false, levelNote, onRetry, onPressCategory }: Props) {
  const breakpoint = useBreakpoint();
  const header = (
    <View style={styles.header}>
      <DisplayText weight={900} size={26} accessibilityRole="header">
        Categorías
      </DisplayText>
      <MonoText size={11} muted>
        {['Funciones según la clasificación vigente del MEF. Costo actual total por función.', levelNote]
          .filter(Boolean)
          .join(' ')}
      </MonoText>
    </View>
  );
  const empty =
    status === 'pending' ? (
      <StateMessage kind="loading" />
    ) : status === 'error' ? (
      <StateMessage kind="error" onRetry={onRetry} />
    ) : (
      <StateMessage
        kind="empty"
        message={`No hay proyectos registrados ${national ? 'en el país' : 'en esta región'}.`}
      />
    );

  if (isWide(breakpoint)) {
    const columns = GRID_COLUMNS[breakpoint];
    return (
      <FlatList
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { maxWidth: LAYOUT_MAX_WIDTH, paddingHorizontal: gutterFor(breakpoint) },
        ]}
        data={chunk(summaries, columns)}
        keyExtractor={(row) => row.map((item) => item.function ?? '__none__').join('|')}
        ListHeaderComponent={header}
        renderItem={({ item: row }) => (
          <View testID="category-grid-row" style={styles.gridRow}>
            {row.map((item) => (
              <View key={item.function ?? '__none__'} style={styles.cell}>
                <CategoryCard summary={item} onPress={() => onPressCategory(item.function)} />
              </View>
            ))}
            {Array.from({ length: columns - row.length }, (_, index) => (
              <View key={`spacer-${index}`} style={styles.cell} />
            ))}
          </View>
        )}
        ListEmptyComponent={empty}
      />
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={summaries}
      keyExtractor={(item) => item.function ?? '__none__'}
      ListHeaderComponent={header}
      renderItem={({ item }) => <CategoryRow summary={item} onPress={() => onPressCategory(item.function)} />}
      ListEmptyComponent={empty}
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
  gridRow: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
  /** Equal columns: the cells carry no padding, so flex-basis 0 splits the row evenly. */
  cell: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  card: {
    flexGrow: 1,
    gap: space.lg,
    padding: space.md,
    borderWidth: rule,
    borderColor: colors.ink,
  },
  cardTop: { gap: 2 },
  cardFigures: { gap: 2 },
  cardIncrease: { alignSelf: 'flex-start', backgroundColor: colors.signal, paddingHorizontal: space.xs },
});
