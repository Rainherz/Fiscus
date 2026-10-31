/**
 * Discovery of the latest "Informe de obras paralizadas en el territorio nacional" of the
 * Contraloría on gob.pe. Edition URLs change every quarter, so the ingest reads the collection page,
 * picks the edition with the latest cut-off and reads its page for the Anexo N° 01 spreadsheet.
 * Pure: HTML in, values out.
 */

export const CONTRALORIA_COLLECTION_URL =
  "https://www.gob.pe/institucion/contraloria/colecciones/18230-obras-paralizadas-documentos";

export interface EditionLink {
  title: string;
  /** Absolute URL of the edition page. */
  url: string;
  /** yyyy-mm-dd, the date on the card; null when missing. */
  publishedAt: string | null;
  /** yyyy-mm-dd, last day of the month in the title ("a junio de 2026" -> 2026-06-30). */
  cutoff: string;
}

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  setiembre: 9,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};
const MONTH_NAMES = Object.keys(MONTHS).join("|");

const pad = (n: number) => String(n).padStart(2, "0");

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Named entities of the list above and numeric entities. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const value = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/** "17 de agosto de 2026" -> 2026-08-17; null otherwise. */
export function parseSpanishDate(text: string): string | null {
  const match = new RegExp(`^\\s*(\\d{1,2})\\s+de\\s+(${MONTH_NAMES})\\s+de\\s+(\\d{4})\\s*$`, "i").exec(text);
  if (!match) return null;
  return isoDate(Number(match[3]), MONTHS[match[2]!.toLowerCase()]!, Number(match[1]));
}

/**
 * Cut-off of an edition from its title: "... obras paralizadas en el territorio nacional a junio de
 * 2026" (or "a marzo 2026") -> last day of that month. Null for any other title.
 */
export function parseEditionCutoff(title: string): string | null {
  const pattern = new RegExp(
    `obras\\s+paralizadas\\s+en\\s+el\\s+territorio\\s+nacional\\s+a\\s+(${MONTH_NAMES})\\s+(?:de\\s+)?(\\d{4})`,
    "i",
  );
  const match = pattern.exec(title);
  if (!match) return null;
  const year = Number(match[2]);
  const month = MONTHS[match[1]!.toLowerCase()]!;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return isoDate(year, month, lastDay);
}

/**
 * The edition cards of the collection page: a date line followed by a link to the edition. Cards
 * whose title is not an edition of the report are left out.
 */
export function parseCollectionEditions(html: string, baseUrl: string): EditionLink[] {
  const card =
    /<div[^>]*class="[^"]*\bpb-2\b[^"]*"[^>]*>([^<]*)<\/div>\s*<a[^>]*href="([^"]*\/informes-publicaciones\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const editions: EditionLink[] = [];
  for (const match of html.matchAll(card)) {
    const title = stripTags(match[3]!);
    const cutoff = parseEditionCutoff(title);
    if (cutoff === null) continue;
    editions.push({
      title,
      url: new URL(decodeEntities(match[2]!), baseUrl).toString(),
      publishedAt: parseSpanishDate(decodeEntities(match[1]!)),
      cutoff,
    });
  }
  return editions;
}

/** The edition with the latest cut-off; for the same cut-off, the latest publication. */
export function latestEdition(editions: readonly EditionLink[]): EditionLink | null {
  let best: EditionLink | null = null;
  for (const edition of editions) {
    if (
      best === null ||
      edition.cutoff > best.cutoff ||
      (edition.cutoff === best.cutoff && (edition.publishedAt ?? "") > (best.publishedAt ?? ""))
    ) {
      best = edition;
    }
  }
  return best;
}

/** URL of the Anexo N° 01 spreadsheet (the list of paralyzed obras) on an edition page; null if absent. */
export function findAnexo01Url(html: string): string | null {
  for (const match of html.matchAll(/href="([^"]+)"/gi)) {
    const url = decodeEntities(match[1]!);
    const file = url.split("?")[0]!.split("/").pop() ?? "";
    if (/^https:\/\//i.test(url) && /anexo-n-?0?1-/i.test(file) && /\.xlsx$/i.test(file)) return url;
  }
  return null;
}

/** The publication date on an edition page (a paragraph with only a date); null if absent. */
export function parseEditionPublishedAt(html: string): string | null {
  for (const match of html.matchAll(/<p[^>]*>([^<]{6,40})<\/p>/gi)) {
    const date = parseSpanishDate(decodeEntities(match[1]!));
    if (date) return date;
  }
  return null;
}
