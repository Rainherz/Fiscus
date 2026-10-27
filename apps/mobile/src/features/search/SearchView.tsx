import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { withRegion } from '@/features/department/scope';
import type { Investment } from '@/features/investments/domain/investment';
import { formatSoles } from '@/shared/format';
import { colors, fonts, maxContentWidth, rule, space } from '@/shared/theme/tokens';
import { RankingRow } from '@/shared/ui/RankingRow';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

interface Props {
  text: string;
  /** The selected department, or null for all of Peru. */
  departmentName: string | null;
  results: Investment[];
  /** idle = nothing searchable typed yet. */
  status: 'idle' | 'pending' | 'error' | 'success';
  onChangeText: (text: string) => void;
  onRetry: () => void;
  onPressInvestment: (cui: string) => void;
}

export function SearchView({
  text,
  departmentName,
  results,
  status,
  onChangeText,
  onRetry,
  onPressInvestment,
}: Props) {
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      data={status === 'success' ? results : []}
      keyExtractor={(item) => item.cui}
      ListHeaderComponent={
        <View style={styles.header}>
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
            {departmentName === null
              ? 'Escribe al menos 3 letras del nombre o un CUI completo. Busca en todo el país.'
              : `Escribe al menos 3 letras del nombre (en ${departmentName}) o un CUI completo (todo el país).`}
          </MonoText>
        </View>
      }
      renderItem={({ item, index }) => (
        <RankingRow
          rank={index + 1}
          name={item.name}
          value={formatSoles(item.updatedCost)}
          detail={departmentName === null ? withRegion(item.departmentCode, `CUI ${item.cui}`) : `CUI ${item.cui}`}
          onPress={() => onPressInvestment(item.cui)}
        />
      )}
      ListEmptyComponent={
        status === 'pending' ? (
          <StateMessage kind="loading" message="Buscando…" />
        ) : status === 'error' ? (
          <StateMessage kind="error" onRetry={onRetry} />
        ) : status === 'success' ? (
          <StateMessage kind="empty" message={`Sin resultados para “${text.trim()}”.`} />
        ) : undefined
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
  header: { paddingTop: space.lg, paddingBottom: space.md, gap: space.sm },
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
