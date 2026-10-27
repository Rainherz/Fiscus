import type { EntityComparison } from '../investments/domain/entityComparison';
import { isGovernmentLevel, type LevelFilter } from '../investments/domain/governmentLevel';
import { isProjectTab, type ProjectTab } from './rankingPresentation';

/** `/entity?name=…&level=GL&tab=…`: the projects of one entity, in the current region. */
export function entityHref(entity: Pick<EntityComparison, 'entity' | 'governmentLevel'>) {
  return {
    pathname: '/entity' as const,
    params: entity.governmentLevel ? { name: entity.entity, level: entity.governmentLevel } : { name: entity.entity },
  };
}

export interface EntityParams {
  entity: string;
  /** The entity's own level, so the global level does not hide its projects. */
  level: LevelFilter;
  tab: ProjectTab;
}

export function parseEntityParams(params: { name?: string; level?: string; tab?: string }): EntityParams | null {
  if (!params.name) return null;
  return {
    entity: params.name,
    level: isGovernmentLevel(params.level) ? params.level : 'ALL',
    tab: isProjectTab(params.tab) ? params.tab : 'increase-amount',
  };
}
