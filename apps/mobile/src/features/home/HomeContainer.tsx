import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';

import { department, departmentCodeOf } from '@/features/department/scope';
import { useScope } from '@/features/department/ScopeContext';
import { DataFooterContainer } from '@/features/investments/DataFooterContainer';
import { useTopIncreases } from '@/features/investments/hooks/queries';
import { StalledPreviewContainer } from '@/features/stalled/StalledPreviewContainer';
import { colors } from '@/shared/theme/tokens';
import { StateMessage } from '@/shared/ui/StateMessage';

import { HomeView } from './HomeView';
import { RecentIncreasesContainer } from './RecentIncreasesContainer';
import { TopRegionsContainer } from './TopRegionsContainer';

/** Hero + the next five increases. */
const TOP_COUNT = 6;

export function HomeContainer() {
  const router = useRouter();
  const { scope, setScope } = useScope();
  const code = departmentCodeOf(scope);
  const national = code === undefined;
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
      national={national}
      onPressInvestment={openInvestment}
      onPressSeeAll={() => router.navigate({ pathname: '/rankings', params: { tab: 'increase-amount' } })}
      regions={
        national ? (
          <TopRegionsContainer
            onPressRegion={(next) => setScope(department(next))}
            onPressSeeAll={() => router.push('/region')}
          />
        ) : undefined
      }
      recentIncreases={<RecentIncreasesContainer departmentCode={code} onPressInvestment={openInvestment} />}
      stalled={
        <StalledPreviewContainer
          departmentCode={code}
          onPressInvestment={openInvestment}
          onPressSeeAll={() => router.navigate({ pathname: '/rankings', params: { tab: 'stalled' } })}
        />
      }
      footer={<DataFooterContainer />}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
});
