import { isStatusFilter, type StatusFilter } from '../investments/domain/investmentStatus';

/** Default status filter: active projects, what every screen showed before closed projects arrived. */
export const DEFAULT_STATUS: StatusFilter = 'ACTIVE';

export function serializeStatus(status: StatusFilter): string {
  return status;
}

/** A stored status filter, or null when the value is missing or not a known filter. */
export function parseStatus(raw: string | null): StatusFilter | null {
  return isStatusFilter(raw) ? raw : null;
}

/** Same rules as the scope and the level: a selection made before hydration wins over the stored value. */
export interface StatusState {
  status: StatusFilter;
  ready: boolean;
  chosen: boolean;
}

export type StatusAction = { type: 'hydrated'; stored: StatusFilter | null } | { type: 'selected'; status: StatusFilter };

export function statusReducer(state: StatusState, action: StatusAction): StatusState {
  switch (action.type) {
    case 'hydrated':
      if (state.chosen) return { ...state, ready: true };
      return { status: action.stored ?? DEFAULT_STATUS, ready: true, chosen: false };
    case 'selected':
      return { status: action.status, ready: true, chosen: true };
  }
}
