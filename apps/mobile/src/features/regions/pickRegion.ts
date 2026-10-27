import type { Scope } from '../department/scope';

/** Tapping an option in the picker: it becomes the global scope, then the picker closes. */
export function pickRegion(scope: Scope, actions: { setScope: (scope: Scope) => void; close: () => void }): void {
  actions.setScope(scope);
  actions.close();
}
