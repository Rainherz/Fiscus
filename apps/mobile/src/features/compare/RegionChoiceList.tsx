import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { colors, maxContentWidth, minTouch, space } from '@/shared/theme/tokens';
import { OptionRow } from '@/shared/ui/OptionRow';
import { RankingRow } from '@/shared/ui/RankingRow';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import type { Department } from '../department/departments';
import { rankRegions, type RegionComparison } from '../investments/domain/regionComparison';
import {
  ALPHABETICAL_DEPARTMENTS,
  departmentsWithoutData,
  regionDetail,
  regionName,
  regionNote,
  regionValue,
} from '../regions/regionPresentation';

interface Props {
  title: string;
  regions: RegionComparison[];
  /** The department currently on this side. */
  selected: number;
  onPick: (code: number) => void;
  onClose: () => void;
  topInset?: number;
  bottomInset?: number;
}

type Item = { kind: 'ranked'; region: RegionComparison; rank: number } | { kind: 'plain'; department: Department };

function toItems(regions: RegionComparison[]): Item[] {
  if (regions.length === 0) return ALPHABETICAL_DEPARTMENTS.map((department) => ({ kind: 'plain', department }));
  return [
    ...rankRegions(regions, 'increase-amount').map((region, index): Item => ({ kind: 'ranked', region, rank: index + 1 })),
    ...departmentsWithoutData(regions).map((department): Item => ({ kind: 'plain', department })),
  ];
}

/**
 * Chooses the region of one side of the comparison. Unlike the region picker, it never changes
 * the app's scope.
 */
export function RegionChoiceList({ title, regions, selected, onPick, onClose, topInset = 0, bottomInset = 0 }: Props) {
  const items = toItems(regions);
  const ranked = regions.length > 0;
  return (
    <View style={styles.screen}>
      <View style={[styles.bar, { paddingTop: topInset + space.sm }]}>
        <View style={styles.titles}>
          <MonoText bold size={11} style={styles.eyebrow}>
            COMPARAR REGIONES
          </MonoText>
          <DisplayText weight={900} size={26} style={styles.title} accessibilityRole="header">
            {title}
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
        initialNumToRender={items.length}
        keyExtractor={(item) => String(item.kind === 'ranked' ? item.region.departmentCode : item.department.code)}
        ListHeaderComponent={
          ranked ? (
            <MonoText size={11} muted style={styles.note}>
              {`Ordenadas por aumento total (S/). ${regionNote('increase-amount')}`}
            </MonoText>
          ) : undefined
        }
        renderItem={({ item }) =>
          item.kind === 'ranked' ? (
            <RankingRow
              rank={item.rank}
              name={regionName(item.region)}
              value={regionValue('increase-amount', item.region)}
              detail={regionDetail('increase-amount', item.region)}
              selected={item.region.departmentCode === selected}
              onPress={() => onPick(item.region.departmentCode)}
            />
          ) : (
            <OptionRow
              name={item.department.name}
              detail={ranked ? 'Sin datos' : undefined}
              selected={item.department.code === selected}
              onPress={() => onPick(item.department.code)}
            />
          )
        }
      />
    </View>
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
  listContent: { paddingHorizontal: space.lg, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  note: { paddingTop: space.lg, paddingBottom: space.sm },
});
