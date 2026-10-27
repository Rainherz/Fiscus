import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';

import { useDepartment } from '@/features/department/DepartmentContext';
import { DataFooterContainer } from '@/features/investments/DataFooterContainer';
import { useTopIncreases } from '@/features/investments/hooks/queries';
import { colors } from '@/shared/theme/tokens';
import { StateMessage } from '@/shared/ui/StateMessage';

import { HomeView } from './HomeView';
import { RecentIncreasesContainer } from './RecentIncreasesContainer';

/** Hero + the next five increases. */
const TOP_COUNT = 6;

export function HomeContainer() {
  const router = useRouter();
  const { code } = useDepartment();
  const top = useTopIncreases(code, TOP_COUNT);

  if (top.status !== 'success') {
    return (
      <View style={styles.screen}>
        {top.status === 'pending' ? (
          <StateMessage kind="loading" />
        ) : (
          <StateMessage kind="error" onRetry={() => top.refetch()} />
        )}
      </View>
    );
  }

  const [hero = null, ...ranking] = top.data;
  const openInvestment = (cui: string) => router.push({ pathname: '/investment/[cui]', params: { cui } });
  return (
    <HomeView
      hero={hero}
      ranking={ranking}
      now={new Date()}
      onPressInvestment={openInvestment}
      onPressSeeAll={() => router.navigate('/rankings')}
      recentIncreases={<RecentIncreasesContainer departmentCode={code} onPressInvestment={openInvestment} />}
      footer={<DataFooterContainer />}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
});
