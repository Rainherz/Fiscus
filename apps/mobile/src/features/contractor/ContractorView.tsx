import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { TermHint } from '@/features/glossary/TermHint';
import { levelTag } from '@/features/government-level/levelPresentation';
import {
  contractorKindLabel,
  contractorStatusLine,
  contractorWorkRow,
  identifierText,
  infobrasCaveat,
} from '@/features/infobras/infobrasPresentation';
import type { ContractorSummary, ContractorWork } from '@/features/investments/domain/infobras';
import { infobrasUrl } from '@/features/investments/domain/paralyzed';
import { formatInteger, formatSoles } from '@/shared/format';
import { gutterFor, isWide } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
import { colors, maxContentWidth, rule, space } from '@/shared/theme/tokens';
import { RankingRow } from '@/shared/ui/RankingRow';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

interface Props {
  /** Null: no such contractor in INFOBRAS. */
  summary: ContractorSummary | null;
  works: readonly ContractorWork[];
  /** Of the obras list. */
  status: 'pending' | 'error' | 'success';
  isFetchingMore: boolean;
  onEndReached: () => void;
  onRetry: () => void;
  onPressInvestment: (cui: string) => void;
  /** Opens the INFOBRAS ficha of an obra whose CUI Fiscus does not have. */
  onOpenUrl: (url: string) => void;
}

/** A wider column than the phone one on tablet and desktop, for a header with four figures. */
const WIDE_WIDTH = 880;

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.figure}>
      <MonoText size={10} muted>
        {label.toUpperCase()}
      </MonoText>
      <MonoText bold size={18}>
        {value}
      </MonoText>
    </View>
  );
}

function Header({ summary }: { summary: ContractorSummary }) {
  const statuses = contractorStatusLine(summary);
  return (
    <View style={styles.header}>
      <View style={styles.kicker}>
        <MonoText bold size={11} muted>
          CONTRATISTA
        </MonoText>
        <TermHint term="contratista" />
      </View>
      <DisplayText weight={900} size={26} accessibilityRole="header">
        {summary.name ?? summary.ruc}
      </DisplayText>
      <MonoText size={12}>{`${contractorKindLabel(summary.kind)} · ${identifierText(summary.ruc)}`}</MonoText>
      <View style={styles.figures}>
        <Figure label="Obras" value={formatInteger(summary.obraCount)} />
        <Figure label="Monto contratado" value={formatSoles(summary.totalContractAmount)} />
        <Figure label="Adicionales de obra" value={formatSoles(summary.totalAdditionalWorks)} />
        <Figure label="Obras en el informe de obras paralizadas" value={formatInteger(summary.contraloriaParalyzedCount)} />
      </View>
      {statuses ? <MonoText size={12}>{statuses}</MonoText> : null}
      <MonoText size={11} muted>{`Totales de todo el país. ${infobrasCaveat(summary.dataAsOf)}`}</MonoText>
      <MonoText bold size={12} style={styles.listTitle}>
        OBRAS
      </MonoText>
    </View>
  );
}

/**
 * `/contractor?ruc=…`: one company or consortium from INFOBRAS, its national totals and its obras
 * (largest contract first), each opening its project or, without one in Fiscus, its INFOBRAS ficha.
 */
export function ContractorView({
  summary,
  works,
  status,
  isFetchingMore,
  onEndReached,
  onRetry,
  onPressInvestment,
  onOpenUrl,
}: Props) {
  const breakpoint = useBreakpoint();
  const wide = isWide(breakpoint);
  const column = [styles.column, wide && { maxWidth: WIDE_WIDTH, paddingHorizontal: gutterFor(breakpoint) - space.lg }];

  if (summary === null) {
    return <StateMessage kind="empty" message="No hay datos de este contratista en INFOBRAS." />;
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[styles.content, column]}
      data={works}
      keyExtractor={(work) => String(work.infobrasCode)}
      ListHeaderComponent={<Header summary={summary} />}
      renderItem={({ item, index }) => {
        const row = contractorWorkRow(item);
        const known = item.cui !== null && item.investmentName !== null;
        return (
          <RankingRow
            rank={index + 1}
            name={row.name}
            detail={row.detail}
            tag={levelTag(item.governmentLevel)}
            onPress={() => (known ? onPressInvestment(item.cui!) : onOpenUrl(infobrasUrl(item.infobrasCode)))}
          />
        );
      }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        status === 'pending' ? (
          <StateMessage kind="loading" />
        ) : status === 'error' ? (
          <StateMessage kind="error" onRetry={onRetry} />
        ) : (
          <StateMessage kind="empty" message="No hay obras de este contratista." />
        )
      }
      ListFooterComponent={isFetchingMore ? <ActivityIndicator color={colors.ink} style={styles.more} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.concrete },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  column: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  header: { paddingTop: space.lg, gap: space.sm },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  figures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space.xl,
    rowGap: space.sm,
    borderTopWidth: rule,
    borderBottomWidth: rule,
    borderColor: colors.ink,
    paddingVertical: space.sm,
    marginTop: space.xs,
  },
  figure: { gap: 2, minWidth: 120 },
  listTitle: { marginTop: space.md },
  more: { paddingVertical: space.lg },
});
