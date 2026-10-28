import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { withRegion } from '@/features/department/scope';
import { levelTag } from '@/features/government-level/levelPresentation';
import type { Investment } from '@/features/investments/domain/investment';
import { formatSoles } from '@/shared/format';
import { gutterFor, isWide, LAYOUT_MAX_WIDTH } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
import { colors, fonts, maxContentWidth, rule, space } from '@/shared/theme/tokens';
import { TableHeader, TableRow } from '@/shared/ui/DataTable';
import { RankingRow } from '@/shared/ui/RankingRow';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import { searchTable } from './searchTable';

interface Props {
  text: string;
  /** The selected department, or null for all of Peru. */
  departmentName: string | null;
  /** The selected government level, or null/absent for every level. */
  levelLabel?: string | null;
  results: Investment[];
  /** idle = nothing searchable typed yet. */
  status: 'idle' | 'pending' | 'error' | 'success';
  onChangeText: (text: string) => void;
  onRetry: () => void;
  onPressInvestment: (cui: string) => void;
}

/** Names are searched in the scope and level; a CUI is unique, so it is looked up everywhere. */
function searchHint(departmentName: string | null, levelLabel: string | null): string {
  const level = levelLabel?.toLowerCase();
  if (departmentName === null) {
    return level
      ? `Escribe al menos 3 letras del nombre (${level}) o un CUI completo (todos los niveles). Busca en todo el país.`
      : 'Escribe al menos 3 letras del nombre o un CUI completo. Busca en todo el país.';
  }
  return level
    ? `Escribe al menos 3 letras del nombre (en ${departmentName}, ${level}) o un CUI completo (todo el país, todos los niveles).`
    : `Escribe al menos 3 letras del nombre (en ${departmentName}) o un CUI completo (todo el país).`;
}

export function SearchView({
  text,
  departmentName,
  levelLabel = null,
  results,
  status,
  onChangeText,
  onRetry,
  onPressInvestment,
}: Props) {
  const breakpoint = useBreakpoint();
  const wide = isWide(breakpoint);
  const header = (
    <View testID="search-header" style={[styles.header, wide && styles.headerWide]}>
      <DisplayText weight={900} size={26} accessibilityRole="header">
        Buscar
      </DisplayText>
      <TextInput
        value={text}
        onChangeText={onChangeText}
        accessibilityLabel="Buscar por nombre o CUI"
        placeholder="Nombre del proyecto o CUI"
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={styles.input}
      />
      <MonoText size={11} muted>
        {searchHint(departmentName, levelLabel)}
      </MonoText>
    </View>
  );
  const empty =
    status === 'pending' ? (
      <StateMessage kind="loading" message="Buscando…" />
    ) : status === 'error' ? (
      <StateMessage kind="error" onRetry={onRetry} />
    ) : status === 'success' ? (
      <StateMessage kind="empty" message={`Sin resultados para “${text.trim()}”.`} />
    ) : undefined;

  if (wide) {
    const spread = breakpoint === 'desktop';
    const national = departmentName === null;
    const table = searchTable(status === 'success' ? results : [], { national, compact: !spread });
    const layout = { columns: table.columns, spread, national };
    return (
      <FlatList
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { maxWidth: LAYOUT_MAX_WIDTH, paddingHorizontal: gutterFor(breakpoint) },
        ]}
        keyboardShouldPersistTaps="handled"
        data={table.rows}
        keyExtractor={(row) => row.key}
        ListHeaderComponent={
          <>
            {header}
            {table.rows.length > 0 ? <TableHeader {...layout} /> : null}
          </>
        }
        renderItem={({ item: row, index }) => (
          <TableRow {...layout} rank={index + 1} row={row} onPress={() => onPressInvestment(row.cui)} />
        )}
        ListEmptyComponent={empty}
      />
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      data={status === 'success' ? results : []}
      keyExtractor={(item) => item.cui}
      ListHeaderComponent={header}
      renderItem={({ item, index }) => (
        <RankingRow
          rank={index + 1}
          name={item.name}
          value={formatSoles(item.updatedCost)}
          detail={departmentName === null ? withRegion(item.departmentCode, `CUI ${item.cui}`) : `CUI ${item.cui}`}
          tag={levelTag(item.governmentLevel)}
          onPress={() => onPressInvestment(item.cui)}
        />
      )}
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
  header: { paddingTop: space.lg, paddingBottom: space.md, gap: space.sm },
  /** Wide screens: the field keeps a readable width, the results use the full column. */
  headerWide: { maxWidth: 720 },
  input: {
    minHeight: 48,
    borderWidth: rule,
    borderColor: colors.ink,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: space.md,
    fontFamily: fonts.body400,
    fontSize: 16,
    color: colors.ink,
  },
});
