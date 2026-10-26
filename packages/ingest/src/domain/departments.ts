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
