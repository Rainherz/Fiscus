import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouch, rule, space } from '../theme/tokens';
import { LevelTag, type Tag } from './LevelTag';
import { BodyText, MonoText } from './typography';

/** A figure column of a wide (tablet and desktop) table. */
export interface TableColumn {
  key: string;
  label: string;
  /** The figure the list is ranked by: highlighted header, bold values. */
  sorted: boolean;
}

export interface TableRowData {
  key: string;
  name: string;
  /** Second line under the name (the entity of a project). */
  sub: string | null;
  tag?: Tag;
  region: string;
  /** One value per column, in column order. */
  cells: string[];
  /** Announced after the name and the level (region and figures with their column names). */
  summary: string;
}

interface Layout {
  columns: readonly TableColumn[];
  /** Show the level and region as their own columns (desktop); otherwise under the name. */
  spread: boolean;
  /** Ranking all of Peru: the region is shown. */
  national: boolean;
}

/** Column header row; hidden from screen readers, every row announces its figures with their names. */
export function TableHeader({ columns, spread, national }: Layout) {
  return (
    <View
      testID="table-header"
      style={styles.header}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <MonoText bold size={11} muted style={styles.rank}>
        #
      </MonoText>
      <MonoText bold size={11} muted style={styles.name}>
        NOMBRE
      </MonoText>
      {spread ? (
        <MonoText bold size={11} muted style={styles.level}>
          NIVEL
        </MonoText>
      ) : null}
      {spread && national ? (
        <MonoText bold size={11} muted style={styles.region}>
          REGIÓN
        </MonoText>
      ) : null}
      {columns.map((column) => (
        <View key={column.key} style={[styles.figure, column.sorted && styles.sortedHead]}>
          <MonoText bold size={11} style={[styles.figureText, column.sorted ? styles.sortedHeadText : styles.headText]}>
            {column.label.toUpperCase()}
          </MonoText>
        </View>
      ))}
    </View>
  );
}

interface RowProps extends Layout {
  rank: number;
  row: TableRowData;
  onPress: () => void;
}

/** One ranked row: rank, name (two lines at most) with its entity, level, region and figures. */
export function TableRow({ rank, row, columns, spread, national, onPress }: RowProps) {
  const inline = !spread && (row.tag || national);
  return (
    <Pressable
      testID="table-row"
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${row.name}, ${row.tag ? `${row.tag.label}, ` : ''}${row.summary}`}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        (pressed || hovered) && styles.pressed,
      ]}>
      <MonoText bold size={12} style={styles.rank}>
        {rank}
      </MonoText>
      <View style={[styles.name, styles.nameBlock]}>
        <BodyText weight={600} size={14} numberOfLines={2}>
          {row.name}
        </BodyText>
        {row.sub ? (
          <MonoText size={11} muted numberOfLines={1}>
            {row.sub}
          </MonoText>
        ) : null}
        {inline ? (
          <View style={styles.inline}>
            {row.tag ? <LevelTag tag={row.tag} /> : null}
            {national ? (
              <MonoText size={11} muted>
                {row.region}
              </MonoText>
            ) : null}
          </View>
        ) : null}
      </View>
      {spread ? <View style={styles.level}>{row.tag ? <LevelTag tag={row.tag} /> : null}</View> : null}
      {spread && national ? (
        <MonoText size={12} style={styles.region} numberOfLines={2}>
          {row.region}
        </MonoText>
      ) : null}
      {columns.map((column, index) => (
        <View key={column.key} style={styles.figure}>
          <MonoText bold={column.sorted} size={13} style={styles.figureText}>
            {row.cells[index]}
          </MonoText>
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.md,
    borderBottomWidth: rule,
    borderBottomColor: colors.ink,
    backgroundColor: colors.concrete,
  },
  row: {
    minHeight: minTouch + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm + 2,
    borderBottomWidth: rule,
    borderBottomColor: colors.ink,
  },
  pressed: { backgroundColor: colors.concretePressed },
  rank: { width: 28, alignSelf: 'center', paddingVertical: space.sm },
  name: { flex: 3, minWidth: 180, alignSelf: 'center' },
  nameBlock: { gap: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, marginTop: 2 },
  level: { width: 44, alignSelf: 'center', alignItems: 'flex-start' },
  region: { flex: 1.1, alignSelf: 'center' },
  figure: { flex: 1, minWidth: 84, justifyContent: 'center', paddingHorizontal: space.xs },
  figureText: { textAlign: 'right' },
  headText: { color: colors.muted },
  sortedHead: { backgroundColor: colors.ink, paddingVertical: space.sm },
  sortedHeadText: { color: colors.signal },
});
