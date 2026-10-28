import type { CostChange, RecentCostIncrease } from '../domain/costChange';
import type { EntityComparison } from '../domain/entityComparison';
import type { LevelFilter } from '../domain/governmentLevel';
import type { FunctionSummary, IngestRun, Investment } from '../domain/investment';
import type { MapListPage, MapListRequest, MapPoints, MapPointsRequest } from '../domain/mapPoints';
import type { InvestmentQuery } from '../domain/queries';
import type { RegionComparison, RegionSort } from '../domain/regionComparison';
import type { StalledInvestment } from '../domain/stalled';

/**
 * Read-only access to public investment data. Every `departmentCode` is optional: undefined
 * means all of Peru. Every `level` is optional: undefined or 'ALL' means every government level.
 * National reads stay paged or limited (about 165k investments with every level).
 */
export interface InvestmentsRepository {
  findMany(query: InvestmentQuery): Promise<Investment[]>;
  findByCui(cui: string): Promise<Investment | null>;
  /** Function aggregates for one department or all of Peru, largest current cost first. */
  functionSummaries(departmentCode?: number, level?: LevelFilter): Promise<FunctionSummary[]>;
  lastIngestRun(): Promise<IngestRun | null>;
  /** Recorded cost values of one investment, oldest first. */
  getCostHistory(cui: string): Promise<CostChange[]>;
  /** Recorded increases of the updated cost, newest first. */
  getRecentCostIncreases(params: {
    departmentCode?: number;
    level?: LevelFilter;
    limit: number;
  }): Promise<RecentCostIncrease[]>;
  /** "Sin gasto reciente", largest amount not yet spent first (see domain/stalled). */
  getStalledInvestments(params: {
    departmentCode?: number;
    level?: LevelFilter;
    entity?: string;
    page: number;
    pageSize?: number;
  }): Promise<StalledInvestment[]>;
  countStalledInvestments(departmentCode?: number, level?: LevelFilter): Promise<number>;
  /** Latest last accrual month of every level (first day of a month), or null without data. */
  getAccrualReferenceMonth(): Promise<string | null>;
  /** One row per department with data, ordered by department code (see domain/regionComparison). */
  getRegionComparison(level?: LevelFilter): Promise<RegionComparison[]>;
  /** "Entidades": a page of entities in the scope, ranked by `sort` (see buildEntityQuery). */
  getEntityComparison(params: {
    sort: RegionSort;
    departmentCode?: number;
    level?: LevelFilter;
    page: number;
    pageSize?: number;
  }): Promise<EntityComparison[]>;
  /** The map view: grid clusters or up to 500 projects with coordinates (see domain/mapPoints). */
  getMapPoints(request: MapPointsRequest): Promise<MapPoints>;
  /** A page of the projects in the map view that match its filters, largest increase first. */
  getMapList(request: MapListRequest): Promise<MapListPage>;
}
