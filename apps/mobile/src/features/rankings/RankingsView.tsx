import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import type { Investment, RankingKind } from '@/features/investments/domain/investment';
import { colors, maxContentWidth, space } from '@/shared/theme/tokens';
import { RankingRow } from '@/shared/ui/RankingRow';
import { SegmentedTabs } from '@/shared/ui/SegmentedTabs';
import { StateMessage } from '@/shared/ui/StateMessage';
import { MonoText } from '@/shared/ui/typography';

import { RANKING_OPTIONS, rankingDetail, rankingNote, rankingValue } from './rankingPresentation';

interface Props {
  kind: RankingKind;
  items: Investment[];
  now: Date;
  status: 'pending' | 'error' | 'success';
  isFetchingMore: boolean;
  onSelectKind: (kind: RankingKind) => void;
  onEndReached: () => void;
  onRetry: () => void;
  onPressInvestment: (cui: string) => void;
}

export function RankingsView({
  kind,
  items,
  now,
  status,
  isFetchingMore,
  onSelectKind,
  onEndReached,
  onRetry,
  onPressInvestment,
}: Props) {
  const note = rankingNote(kind);

  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
        <SegmentedTabs options={RANKING_OPTIONS} selected={kind} onSelect={onSelectKind} />
        {note ? (
          <MonoText size={11} muted style={styles.note}>
            {note}
          </MonoText>
        ) : null}
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(item) => item.cui}
        renderItem={({ item, index }) => (
          <RankingRow
            rank={index + 1}
            name={item.name}
            value={rankingValue(kind, item, now)}
            detail={rankingDetail(kind, item)}
            onPress={() => onPressInvestment(item.cui)}
          />
        )}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          status === 'pending' ? (
            <StateMessage kind="loading" />
          ) : status === 'error' ? (
            <StateMessage kind="error" onRetry={onRetry} />
          ) : (
            <StateMessage kind="empty" message="No hay proyectos para este ranking en esta región." />
          )
        }
        ListFooterComponent={
          isFetchingMore ? <ActivityIndicator color={colors.ink} style={styles.more} /> : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  tabs: {
    paddingTop: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  note: { paddingHorizontal: space.lg },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  more: { paddingVertical: space.lg },
});
