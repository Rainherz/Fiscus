export interface Department {
  code: number;
  name: string;
}

/** MEF "plie" codes for Peru's departments (regional governments). */
export const DEPARTMENTS: readonly Department[] = [
  { code: 1, name: "Amazonas" },
  { code: 2, name: "Áncash" },
  { code: 3, name: "Apurímac" },
  { code: 4, name: "Arequipa" },
  { code: 5, name: "Ayacucho" },
  { code: 6, name: "Cajamarca" },
  { code: 7, name: "Callao" },
  { code: 8, name: "Cusco" },
  { code: 9, name: "Huancavelica" },
  { code: 10, name: "Huánuco" },
  { code: 11, name: "Ica" },
  { code: 12, name: "Junín" },
  { code: 13, name: "La Libertad" },
  { code: 14, name: "Lambayeque" },
  { code: 15, name: "Lima" },
  { code: 16, name: "Loreto" },
  { code: 17, name: "Madre de Dios" },
  { code: 18, name: "Moquegua" },
  { code: 19, name: "Pasco" },
  { code: 20, name: "Piura" },
  { code: 21, name: "Puno" },
  { code: 22, name: "San Martín" },
  { code: 23, name: "Tacna" },
  { code: 24, name: "Tumbes" },
  { code: 25, name: "Ucayali" },
];

export function departmentName(code: number): string | null {
  return DEPARTMENTS.find((d) => d.code === code)?.name ?? null;
}

/**
 * INEI ubigeo -> department code. The first two digits of an INEI ubigeo are the department and
 * match the codes above (01 Amazonas ... 07 Callao ... 15 Lima ... 25 Ucayali). MEF uses 99 for
 * investments spanning several departments; that, and anything malformed, yields null.
 */
export function departmentCodeFromUbigeo(ubigeo: string | null | undefined): number | null {
  const match = /^(\d{2})(?:\d{4})?$/.exec(ubigeo?.trim() ?? "");
  if (!match) return null;
  const code = Number(match[1]);
  return DEPARTMENTS.some((d) => d.code === code) ? code : null;
}

function foldName(name: string): string {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toUpperCase();
}

/** Department name as published by MEF ("ANCASH", "SAN MARTIN") -> code; null when unknown. */
export function departmentCodeFromName(name: string | null | undefined): number | null {
  if (!name) return null;
  const folded = foldName(name);
  return DEPARTMENTS.find((d) => foldName(d.name) === folded)?.code ?? null;
}
