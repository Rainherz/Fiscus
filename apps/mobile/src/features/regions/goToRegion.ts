/** Tapping a region: it becomes the global region, then Inicio shows it. */
export function goToRegion(
  code: number,
  actions: { setCode: (code: number) => void; navigateHome: () => void },
): void {
  actions.setCode(code);
  actions.navigateHome();
}
