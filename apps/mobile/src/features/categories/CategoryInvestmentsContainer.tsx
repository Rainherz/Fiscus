import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReadScope, useScope } from '@/features/department/ScopeContext';
import { levelFilterLabel, projectTag } from '@/features/government-level/levelPresentation';
import { useFunctionInvestments } from '@/features/investments/hooks/queries';
import { formatSoles } from '@/shared/format';
import { COMPACT_MAX_WIDTH, isWide } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
import { colors, maxContentWidth, space } from '@/shared/theme/tokens';
import { BackHeader } from '@/shared/ui/BackHeader';
import { RankingRow } from '@/shared/ui/RankingRow';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import { NO_FUNCTION_LABEL } from './CategoriesView';
import { categoryRowDetail } from './categoryPresentation';
import { decodeFunctionParam } from './functionParam';

/** Projects of one function in the selected scope, largest current cost first. */
export function CategoryInvestmentsContainer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ fn: string }>();
  const fn = decodeFunctionParam(params.fn);
  const { label: scopeName } = useScope();
  const read = useReadScope();
  const national = read.departmentCode === undefined;
  const list = useFunctionInvestments(read, fn);
  const items = list.data?.pages.flat() ?? [];
  const label = fn ?? NO_FUNCTION_LABEL;
  const wide = isWide(useBreakpoint());

  return (
    <View style={styles.screen}>
      <BackHeader
        topInset={insets.top}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/categories'))}
      />
      <FlatList
        contentContainerStyle={[styles.content, wide && { maxWidth: COMPACT_MAX_WIDTH }]}
        data={items}
        keyExtractor={(item) => item.cui}
        ListHeaderComponent={
          <View style={styles.header}>
            <DisplayText weight={900} size={26} accessibilityRole="header">
              {label}
            </DisplayText>
            <MonoText size={11} muted>{`${scopeName} · ${levelFilterLabel(read.level)} · ordenado por costo actual`}</MonoText>
          </View>
        }
        renderItem={({ item, index }) => (
          <RankingRow
            rank={index + 1}
            name={item.name}
            value={formatSoles(item.updatedCost)}
            detail={categoryRowDetail(item, { national })}
            tag={projectTag(item)}
            onPress={() => router.push({ pathname: '/investment/[cui]', params: { cui: item.cui } })}
          />
        )}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          list.status === 'pending' ? (
            <StateMessage kind="loading" />
          ) : list.status === 'error' ? (
            <StateMessage kind="error" onRetry={() => list.refetch()} />
          ) : (
            <StateMessage kind="empty" message="No hay proyectos en esta categoría." />
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? <ActivityIndicator color={colors.ink} style={styles.more} /> : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl + 20,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  header: { paddingTop: space.lg, paddingBottom: space.md, gap: space.xs },
  more: { paddingVertical: space.lg },
});
