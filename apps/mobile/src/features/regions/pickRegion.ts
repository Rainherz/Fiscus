/** Tapping a region in the picker: it becomes the global region, then the picker closes. */
export function pickRegion(code: number, actions: { setCode: (code: number) => void; close: () => void }): void {
  actions.setCode(code);
  actions.close();
}
