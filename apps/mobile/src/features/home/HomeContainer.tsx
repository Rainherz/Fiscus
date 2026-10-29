import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';

import { department } from '@/features/department/scope';
import { useReadScope, useScope } from '@/features/department/ScopeContext';
import { DataFooterContainer } from '@/features/investments/DataFooterContainer';
import { useTopIncreases } from '@/features/investments/hooks/queries';
import { StalledPreviewContainer } from '@/features/stalled/StalledPreviewContainer';
import { compareHref } from '@/features/compare/compareSelection';
import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { colors } from '@/shared/theme/tokens';
import { StateMessage } from '@/shared/ui/StateMessage';

import { HomeView } from './HomeView';
import { RecentIncreasesContainer } from './RecentIncreasesContainer';
import { TopRegionsContainer } from './TopRegionsContainer';

/** Hero + the next five increases. */
const TOP_COUNT = 6;

export function HomeContainer() {
  const router = useRouter();
  const { setScope, level } = useScope();
  const read = useReadScope();
  const code = read.departmentCode;
  const national = code === undefined;
  const top = useTopIncreases(read, TOP_COUNT);

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
  const openInvestment = (cui: string) => {
    blurActiveElement();
    router.push({ pathname: '/investment/[cui]', params: { cui } });
  };
  return (
    <HomeView
      hero={hero}
      ranking={ranking}
      now={new Date()}
      national={national}
      onPressInvestment={openInvestment}
      onPressSeeAll={() => router.navigate({ pathname: '/rankings', params: { tab: 'increase-amount' } })}
      onPressMap={() => {
        blurActiveElement();
        router.push('/map');
      }}
      onPressCompare={() => {
        blurActiveElement();
        router.push(compareHref({ a: code }));
      }}
      onPressGuide={() => {
        blurActiveElement();
        router.push('/guia');
      }}
      regions={
        national ? (
          <TopRegionsContainer
            level={level}
            onPressRegion={(next) => setScope(department(next))}
            onPressSeeAll={() => {
              blurActiveElement();
              router.push('/region');
            }}
            onPressCompare={() => {
              blurActiveElement();
              router.push(compareHref());
            }}
          />
        ) : undefined
      }
      recentIncreases={<RecentIncreasesContainer read={read} onPressInvestment={openInvestment} />}
      stalled={
        <StalledPreviewContainer
          read={read}
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
