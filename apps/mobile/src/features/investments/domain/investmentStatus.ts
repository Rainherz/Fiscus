/**
 * The status filter of every read: active projects (MEF status ACTIVO), closed ones (CERRADO), or
 * every status ('ALL'). The values match the `status_group` of the `*_by_status` views and the
 * `status_filter` argument of map_points and map_list. Projects with another or no status only
 * appear under 'ALL'.
 */
export type StatusFilter = 'ACTIVE' | 'CLOSED' | 'ALL';

export const STATUS_FILTERS: readonly StatusFilter[] = ['ACTIVE', 'CLOSED', 'ALL'];

export const ACTIVE_STATUS = 'ACTIVO';
export const CLOSED_STATUS = 'CERRADO';

export function isStatusFilter(value: unknown): value is StatusFilter {
  return typeof value === 'string' && (STATUS_FILTERS as readonly string[]).includes(value);
}

/** The `investments.status` a filter keeps, or null when it keeps every status. */
export function statusValueOf(filter: StatusFilter | undefined): string | null {
  if (filter === 'ACTIVE') return ACTIVE_STATUS;
  if (filter === 'CLOSED') return CLOSED_STATUS;
  return null;
}

/** Whether a project's status passes the filter (undefined or 'ALL' keeps every status). */
export function matchesStatus(status: string | null, filter: StatusFilter | undefined): boolean {
  const wanted = statusValueOf(filter);
  return wanted === null || status === wanted;
}

export function isClosed(investment: { status: string | null }): boolean {
  return investment.status === CLOSED_STATUS;
}
