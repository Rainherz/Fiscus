/** Route param for projects without a function label (cannot collide: MEF labels are uppercase words). */
const NO_FUNCTION = '_sin-funcion';

export function encodeFunctionParam(fn: string | null): string {
  return fn ?? NO_FUNCTION;
}

export function decodeFunctionParam(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (value === undefined || value === NO_FUNCTION) return null;
  return value;
}
