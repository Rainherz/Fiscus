import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInvestment } from '@/features/investments/hooks/queries';
import { colors } from '@/shared/theme/tokens';
import { BackHeader } from '@/shared/ui/BackHeader';
import { StateMessage } from '@/shared/ui/StateMessage';

import { CostHistoryContainer } from './CostHistoryContainer';
import { InvestmentDetailView } from './InvestmentDetailView';

export function InvestmentDetailContainer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cui } = useLocalSearchParams<{ cui: string }>();
  const investment = useInvestment(cui);

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <BackHeader
        topInset={insets.top}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      {investment.status === 'pending' ? (
        <StateMessage kind="loading" />
      ) : investment.status === 'error' ? (
        <StateMessage kind="error" onRetry={() => investment.refetch()} />
      ) : investment.data === null ? (
        <StateMessage kind="empty" message={`No existe un proyecto con CUI ${cui}.`} />
      ) : (
        <InvestmentDetailView
          investment={investment.data}
          now={new Date()}
          costHistory={<CostHistoryContainer cui={cui} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
});
