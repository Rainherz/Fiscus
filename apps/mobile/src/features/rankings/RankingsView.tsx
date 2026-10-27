import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { colors, maxContentWidth, space } from '@/shared/theme/tokens';
import { RankingRow } from '@/shared/ui/RankingRow';
import { SegmentedTabs } from '@/shared/ui/SegmentedTabs';
import { StateMessage } from '@/shared/ui/StateMessage';
import { MonoText } from '@/shared/ui/typography';

import { STALLED_EMPTY, stalledRowDetail } from '../stalled/stalledPresentation';
import {
  RANKING_OPTIONS,
  rankingDetail,
  rankingNote,
  rankingValue,
  type RankingList,
  type RankingTab,
} from './rankingPresentation';

interface Row {
  cui: string;
  name: string | null;
  value?: string;
  detail: string | string[];
}

function toRows(list: RankingList, now: Date, national: boolean): Row[] {
  if (list.kind === 'stalled') {
    return list.items.map((item) => ({ cui: item.cui, name: item.name, detail: stalledRowDetail(item, { national }) }));
  }
  const { kind } = list;
  return list.items.map((item) => ({
    cui: item.cui,
    name: item.name,
    value: rankingValue(kind, item, now),
    detail: rankingDetail(kind, item, { national }),
  }));
}

interface Props {
  list: RankingList;
  now: Date;
  /** Ranking all of Peru: rows show their region. */
  national?: boolean;
  status: 'pending' | 'error' | 'success';
  isFetchingMore: boolean;
  onSelectKind: (kind: RankingTab) => void;
  onEndReached: () => void;
  onRetry: () => void;
  onPressInvestment: (cui: string) => void;
}

export function RankingsView({
  list,
  now,
  national = false,
  status,
  isFetchingMore,
  onSelectKind,
  onEndReached,
  onRetry,
  onPressInvestment,
}: Props) {
  const { kind } = list;
  const note = rankingNote(kind);
  const rows = toRows(list, now, national);

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
        data={rows}
        keyExtractor={(row) => row.cui}
        renderItem={({ item: row, index }) => (
          <RankingRow
            rank={index + 1}
            name={row.name}
            value={row.value}
            detail={row.detail}
            onPress={() => onPressInvestment(row.cui)}
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
            <StateMessage
              kind="empty"
              message={
                kind === 'stalled'
                  ? STALLED_EMPTY
                  : `No hay proyectos para este ranking ${national ? 'en el país' : 'en esta región'}.`
              }
            />
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
