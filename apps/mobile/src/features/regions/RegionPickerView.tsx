import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { colors, maxContentWidth, minTouch, rule, space } from '@/shared/theme/tokens';
import { RankingRow } from '@/shared/ui/RankingRow';
import { SegmentedTabs } from '@/shared/ui/SegmentedTabs';
import { StateMessage } from '@/shared/ui/StateMessage';
import { BodyText, DisplayText, MonoText } from '@/shared/ui/typography';

import type { Department } from '../department/departments';
import type { RegionComparison, RegionSort } from '../investments/domain/regionComparison';
import {
  ALPHABETICAL_DEPARTMENTS,
  REGIONS_EMPTY,
  REGIONS_HEADER_NOTE,
  REGION_SORT_OPTIONS,
  departmentsWithoutData,
  regionDetail,
  regionName,
  regionNote,
  regionSummary,
  regionValue,
} from './regionPresentation';

interface Props {
  sort: RegionSort;
  /** Already ranked by `sort`. */
  regions: RegionComparison[];
  status: 'pending' | 'error' | 'success';
  /** The globally selected department. */
  currentCode: number;
  onSelectSort: (sort: RegionSort) => void;
  onRetry: () => void;
  onPick: (departmentCode: number) => void;
  onClose: () => void;
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

/** Region picker: the 25 departments compared by one figure, all of Peru. Tapping one selects it. */
export function RegionPickerView({
  sort,
  regions,
  status,
  currentCode,
  onSelectSort,
  onRetry,
  onPick,
  onClose,
  topInset = 0,
  bottomInset = 0,
}: Props) {
  const items = toItems(regions, status);
  const ranked = items.some((item) => item.kind === 'ranked');

  return (
    <View style={styles.screen}>
      <View style={[styles.bar, { paddingTop: topInset + space.sm }]}>
        <View style={styles.titles}>
          <MonoText bold size={11} style={styles.eyebrow}>
            TODO EL PERÚ
          </MonoText>
          <DisplayText weight={900} size={26} style={styles.title} accessibilityRole="header">
            Elegir región
          </DisplayText>
        </View>
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
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + space.xl }]}
        accessibilityLabel="Regiones"
        data={items}
        // At most 25 rows: render them all, so every department is reachable at once.
        initialNumToRender={items.length}
        keyExtractor={(item) => String(item.kind === 'ranked' ? item.region.departmentCode : item.department.code)}
        ListHeaderComponent={
          <View style={styles.header}>
            <MonoText size={11} muted>
              {REGIONS_HEADER_NOTE}
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
        }
        renderItem={({ item }) =>
          item.kind === 'ranked' ? (
            <RankingRow
              rank={item.rank}
              name={regionName(item.region)}
              value={regionValue(sort, item.region)}
              detail={regionDetail(sort, item.region)}
              summary={regionSummary(sort, item.region)}
              selected={item.region.departmentCode === currentCode}
              onPress={() => onPick(item.region.departmentCode)}
            />
          ) : (
            <PlainOption
              department={item.department}
              detail={ranked ? 'Sin datos' : undefined}
              selected={item.department.code === currentCode}
              onPress={() => onPick(item.department.code)}
            />
          )
        }
      />
    </View>
  );
}

/** A department without comparison figures. */
function PlainOption({
  department,
  detail,
  selected,
  onPress,
}: {
  department: Department;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const label = [department.name, detail?.toLowerCase(), selected ? 'actual' : undefined].filter(Boolean).join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected ? { selected: true } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && (selected ? styles.pressed : styles.optionPressed),
      ]}>
      <View style={styles.optionMain}>
        <BodyText weight={600} size={14} style={selected ? styles.selectedText : undefined}>
          {department.name}
        </BodyText>
        {detail ? (
          <MonoText size={11} muted style={selected ? styles.selectedDetail : undefined}>
            {detail}
          </MonoText>
        ) : null}
      </View>
      {selected ? (
        <MonoText bold size={11} style={styles.tag}>
          ACTUAL
        </MonoText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  bar: {
    backgroundColor: colors.ink,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.md,
  },
  titles: { flexShrink: 1, gap: 2 },
  eyebrow: { color: colors.concrete },
  title: { color: colors.signal },
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
  // The tabs carry their own gutter; cancel the list's so they align with the notes.
  sorts: { marginHorizontal: -space.lg },
  option: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 9,
    borderTopWidth: rule,
    borderTopColor: colors.ink,
  },
  optionSelected: { backgroundColor: colors.ink, marginHorizontal: -space.sm, paddingHorizontal: space.sm },
  optionPressed: { backgroundColor: colors.concretePressed },
  optionMain: { flex: 1, gap: 2 },
  selectedText: { color: colors.signal },
  selectedDetail: { color: colors.concrete },
  tag: { color: colors.ink, backgroundColor: colors.signal, paddingHorizontal: space.xs },
});
