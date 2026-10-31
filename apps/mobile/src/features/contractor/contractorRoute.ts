/** `/contractor?ruc=…`: a company RUC (20 + 9 digits) or an OSCE consortium code (C + 10 digits). */
export function parseContractorRuc(value: string | undefined): string | null {
  const ruc = value?.trim().toUpperCase();
  return ruc && /^(20\d{9}|C\d{10})$/.test(ruc) ? ruc : null;
}

export function contractorHref(ruc: string) {
  return { pathname: '/contractor' as const, params: { ruc } };
}
