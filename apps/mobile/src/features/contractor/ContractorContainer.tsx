import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useContractorSummary, useContractorWorks } from '@/features/investments/hooks/queries';
import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { colors } from '@/shared/theme/tokens';
import { BackHeader } from '@/shared/ui/BackHeader';
import { StateMessage } from '@/shared/ui/StateMessage';

import { parseContractorRuc } from './contractorRoute';
import { ContractorView } from './ContractorView';

/** `/contractor?ruc=…`: a company or consortium from the "Contratistas" ranking. */
export function ContractorContainer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ ruc?: string }>();
  const ruc = parseContractorRuc(params.ruc);
  const back = () => {
    blurActiveElement();
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/rankings', params: { tab: 'contractors' } });
  };
  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <BackHeader topInset={insets.top} onBack={back} />
      {ruc ? <Contractor ruc={ruc} /> : <StateMessage kind="empty" message="No se indicó un contratista." />}
    </View>
  );
}

function Contractor({ ruc }: { ruc: string }) {
  const router = useRouter();
  const summary = useContractorSummary(ruc);
  const works = useContractorWorks(ruc);
  if (summary.status === 'pending') return <StateMessage kind="loading" />;
  if (summary.status === 'error') return <StateMessage kind="error" onRetry={() => summary.refetch()} />;
  return (
    <ContractorView
      summary={summary.data}
      works={works.data?.pages.flat() ?? []}
      status={works.status}
      isFetchingMore={works.isFetchingNextPage}
      onEndReached={() => {
        if (works.hasNextPage && !works.isFetchingNextPage) works.fetchNextPage();
      }}
      onRetry={() => works.refetch()}
      onPressInvestment={(cui) => {
        blurActiveElement();
        router.push({ pathname: '/investment/[cui]', params: { cui } });
      }}
      // react-native-web opens it in a new tab; iOS and Android in the system browser.
      onOpenUrl={(url) => {
        Linking.openURL(url).catch(() => {});
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
});
