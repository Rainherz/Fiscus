/** The four main sections: route names of the tabs layout and their labels. */
export const MAIN_TABS = [
  { name: 'index', title: 'Inicio' },
  { name: 'rankings', title: 'Rankings' },
  { name: 'categories', title: 'Categorías' },
  { name: 'search', title: 'Buscar' },
] as const;

export type MainTab = (typeof MAIN_TABS)[number]['name'];
