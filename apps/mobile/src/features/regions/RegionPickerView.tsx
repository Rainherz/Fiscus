import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LAYOUT_MAX_WIDTH, gutterFor, isWide } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
import { colors, maxContentWidth, minTouch, rule, space } from '@/shared/theme/tokens';
import { HomeLink } from '@/shared/ui/HomeLink';
import { OptionRow } from '@/shared/ui/OptionRow';
import { RankingRow } from '@/shared/ui/RankingRow';
import { SegmentedTabs } from '@/shared/ui/SegmentedTabs';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import type { Department } from '../department/departments';
import { LEVEL_OPTIONS, regionsNote } from '../government-level/levelPresentation';
import type { LevelFilter } from '../investments/domain/governmentLevel';
import { NATIONAL, NATIONAL_LABEL, department, isSameScope, type Scope } from '../department/scope';
import type { RegionComparison, RegionSort } from '../investments/domain/regionComparison';
import {
  ALPHABETICAL_DEPARTMENTS,
  REGIONS_EMPTY,
  REGION_SORT_OPTIONS,
  departmentsWithoutData,
  regionDetail,
  regionName,
  regionNote,
  regionSummary,
  regionValue,
} from './regionPresentation';

interface Props {
  /** The global government level: it filters the comparison and every screen. */
  level: LevelFilter;
  onSelectLevel: (level: LevelFilter) => void;
  sort: RegionSort;
  /** Already ranked by `sort`. */
  regions: RegionComparison[];
  status: 'pending' | 'error' | 'success';
  /** The globally selected scope. */
  current: Scope;
  onSelectSort: (sort: RegionSort) => void;
  onRetry: () => void;
  onPick: (scope: Scope) => void;
  onClose: () => void;
  /** Opens the side-by-side comparison of two regions. */
  onCompare: () => void;
  topInset?: number;
  bottomInset?: number;
}

type Item = { kind: 'ranked'; region: RegionComparison; rank: number } | { kind: 'plain'; department: Department };

function toItems(regions: RegionComparison[], status: Props['status']): Item[] {
  // Without comparison data the picker still lists every department, so it never blocks navigation.
  if (status !== 'success' || regions.length === 0) {
    return ALPHABETICAL_DEPARTMENTS.map((department) => ({ kind: 'plain', department }));
  }
  return [
    ...regions.map((region, index): Item => ({ kind: 'ranked', region, rank: index + 1 })),
    ...departmentsWithoutData(regions).map((department): Item => ({ kind: 'plain', department })),
  ];
}

/**
 * Region picker: "Todo el Perú" first, then the 25 departments compared by one figure. Tapping an
 * option selects it.
 */
export function RegionPickerView({
  level,
  onSelectLevel,
  sort,
  regions,
  status,
  current,
  onSelectSort,
  onRetry,
  onPick,
  onClose,
  onCompare,
  topInset = 0,
  bottomInset = 0,
}: Props) {
  const items = toItems(regions, status);
  const ranked = items.some((item) => item.kind === 'ranked');
  const isCurrent = (code: number) => isSameScope(current, department(code));
  const breakpoint = useBreakpoint();
  const wide = isWide(breakpoint);
  const gutter = gutterFor(breakpoint);
  const column = wide ? { maxWidth: LAYOUT_MAX_WIDTH, paddingHorizontal: gutter } : null;

  const controls = (
    <View style={styles.header}>
      <View style={styles.levels}>
        <MonoText bold size={11}>
          NIVEL DE GOBIERNO
        </MonoText>
        <View style={styles.sorts}>
          <SegmentedTabs
            options={LEVEL_OPTIONS}
            selected={level}
            onSelect={onSelectLevel}
            accessibilityLabel="Nivel de gobierno"
          />
        </View>
      </View>
      <View style={styles.national}>
        <OptionRow
          name={NATIONAL_LABEL}
          detail={NATIONAL_DETAIL}
          selected={isSameScope(current, NATIONAL)}
          onPress={() => onPick(NATIONAL)}
        />
      </View>
      <MonoText size={11} muted>
        {regionsNote(level)}
      </MonoText>
      {ranked ? (
        <>
          <View style={styles.sorts}>
            <SegmentedTabs
              options={REGION_SORT_OPTIONS}
              selected={sort}
              onSelect={onSelectSort}
              accessibilityLabel="Ordenar regiones por"
            />
          </View>
          <MonoText size={11} muted>
            {regionNote(sort)}
          </MonoText>
        </>
      ) : status === 'pending' ? (
        <StateMessage kind="loading" />
      ) : status === 'error' ? (
        <StateMessage kind="error" onRetry={onRetry} />
      ) : (
        <StateMessage kind="empty" message={REGIONS_EMPTY} />
      )}
    </View>
  );

  const list = (
    <FlatList
      style={styles.list}
      contentContainerStyle={[wide ? styles.listContentWide : styles.listContent, { paddingBottom: bottomInset + space.xl }]}
      accessibilityLabel="Regiones"
      data={items}
      // At most 25 rows: render them all, so every department is reachable at once.
      initialNumToRender={items.length}
      keyExtractor={(item) => String(item.kind === 'ranked' ? item.region.departmentCode : item.department.code)}
      ListHeaderComponent={wide ? undefined : controls}
      renderItem={({ item }) =>
        item.kind === 'ranked' ? (
          <RankingRow
            rank={item.rank}
            name={regionName(item.region)}
            value={regionValue(sort, item.region)}
            detail={regionDetail(sort, item.region)}
            summary={regionSummary(sort, item.region)}
            selected={isCurrent(item.region.departmentCode)}
            onPress={() => onPick(department(item.region.departmentCode))}
          />
        ) : (
          <OptionRow
            name={item.department.name}
            detail={ranked ? 'Sin datos' : undefined}
            selected={isCurrent(item.department.code)}
            onPress={() => onPick(department(item.department.code))}
          />
        )
      }
    />
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.bar, { paddingTop: topInset + space.sm }]}>
        <View style={[styles.barInner, column]}>
          <View style={styles.barTop}>
            <HomeLink size={22} origin="stack" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <MonoText bold size={13} style={styles.closeText}>
                CERRAR ✕
              </MonoText>
            </Pressable>
          </View>
          <View style={styles.titles}>
            <MonoText bold size={11} style={styles.eyebrow}>
              TODO EL PERÚ
            </MonoText>
            <DisplayText weight={900} size={26} style={styles.title} accessibilityRole="header">
              Elegir región
            </DisplayText>
            <MonoText size={11} style={styles.subtitle}>
              {PICKER_SUBTITLE}
            </MonoText>
          </View>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Comparar dos regiones"
        onPress={onCompare}
        style={({ pressed }) => [styles.compare, pressed && styles.comparePressed]}>
        <View style={[styles.compareInner, column]}>
          <DisplayText size={18}>Comparar dos regiones</DisplayText>
          <DisplayText size={18}>⇄</DisplayText>
        </View>
      </Pressable>
      {wide ? (
        <View style={[styles.body, column]}>
          <ScrollView style={styles.panel} contentContainerStyle={{ paddingBottom: bottomInset + space.xl }}>
            {controls}
          </ScrollView>
          {list}
        </View>
      ) : (
        list
      )}
    </View>
  );
}

const NATIONAL_DETAIL = 'Las 25 regiones';
const PICKER_SUBTITLE = 'Las regiones ordenadas por el criterio elegido. Toca una para verla.';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  bar: { backgroundColor: colors.ink, paddingBottom: space.md },
  barInner: { width: '100%', alignSelf: 'center', paddingHorizontal: space.lg },
  barTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  titles: { gap: 2 },
  eyebrow: { color: colors.concrete },
  title: { color: colors.signal },
  subtitle: { color: colors.concrete, marginTop: 2 },
  compare: {
    backgroundColor: colors.signal,
    borderBottomWidth: rule,
    borderBottomColor: colors.ink,
  },
  comparePressed: { backgroundColor: colors.signalPressed },
  compareInner: {
    minHeight: minTouch,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  close: { minHeight: minTouch, minWidth: minTouch, justifyContent: 'center', paddingHorizontal: space.xs },
  closeText: { color: colors.concrete },
  pressed: { opacity: 0.7 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: space.lg,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  header: { paddingTop: space.lg, paddingBottom: space.md, gap: space.sm },
  /** Tablet and desktop: the level, "Todo el Perú" and the sorts on the left, the regions on the right. */
  body: { flex: 1, flexDirection: 'row', gap: space.xl * 2, width: '100%', alignSelf: 'center' },
  panel: { width: 340, flexGrow: 0 },
  listContentWide: { paddingTop: space.lg, maxWidth: 760 },
  /** The level applies to every screen, so it sits above the region options, apart from the sorts. */
  levels: { gap: space.sm, marginBottom: space.sm },
  /** All of Peru sits apart from the comparison, closed by a rule like the list rows. */
  national: { marginBottom: space.sm, borderBottomWidth: rule, borderBottomColor: colors.ink },
  // The tabs carry their own gutter; cancel the list's so they align with the notes.
  sorts: { marginHorizontal: -space.lg },
});
