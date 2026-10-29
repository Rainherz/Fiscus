import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReadScope, useScope } from '@/features/department/ScopeContext';
import { levelName } from '@/features/government-level/levelPresentation';
import type { ReadScope } from '@/features/investments/hooks/queries';
import { blurActiveElement } from '@/shared/navigation/blurActiveElement';
import { colors } from '@/shared/theme/tokens';
import { BackHeader } from '@/shared/ui/BackHeader';
import { StateMessage } from '@/shared/ui/StateMessage';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import { parseEntityParams, type EntityParams } from './entityRoute';
import { useRankingList } from './RankingsContainer';
import { RankingsView } from './RankingsView';

/**
 * The projects of one entity (`/entity?name=…&level=GL&tab=…`) in the current region, with the
 * project rankings of the Rankings screen. The entity's own level applies, not the global one.
 */
export function EntityContainer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ name?: string; level?: string; tab?: string }>();
  const parsed = parseEntityParams(params);
  const back = () => {
    blurActiveElement();
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/rankings', params: { tab: 'entities' } });
  };
  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <BackHeader topInset={insets.top} onBack={back} />
      {parsed ? (
        <EntityProjects params={parsed} />
      ) : (
        <StateMessage kind="empty" message="No se indicó una entidad." />
      )}
    </View>
  );
}

function EntityProjects({ params }: { params: EntityParams }) {
  const router = useRouter();
  const { label: scopeName } = useScope();
  const { departmentCode, status } = useReadScope();
  const read: ReadScope = useMemo(
    () => ({ departmentCode, level: params.level, status, entity: params.entity }),
    [departmentCode, params.level, status, params.entity],
  );
  const ranking = useRankingList(params.tab, read);
  const where = params.level === 'ALL' ? scopeName : `${levelName(params.level)} · ${scopeName}`;

  return (
    <RankingsView
      {...ranking}
      options="projects"
      now={new Date()}
      national={departmentCode === undefined}
      header={
        <>
          <MonoText bold size={11} muted>
            ENTIDAD
          </MonoText>
          <DisplayText weight={900} size={24} accessibilityRole="header">
            {params.entity}
          </DisplayText>
          <MonoText size={11} muted>
            {where}
          </MonoText>
        </>
      }
      onSelectKind={(next) => router.setParams({ tab: next })}
      onPressInvestment={(cui) => router.push({ pathname: '/investment/[cui]', params: { cui } })}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
});
