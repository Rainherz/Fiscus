import { decodeEntities } from "./paralyzedEditions.js";

/**
 * Discovery of the current INFOBRAS obras dataset. The DataSets page links one file whose name
 * carries the generation date ("DataSet-Obras-Publicas 30-10-2026"), so the link is read from the
 * page on every run. Pure: HTML in, values out.
 */

export const INFOBRAS_DATASETS_URL = "https://infobras.contraloria.gob.pe/InfobrasWeb/DataSets";

export interface InfobrasDataSetLink {
  /** Absolute download URL. */
  url: string;
  /** The filename query parameter ("DataSet-Obras-Publicas 30-10-2026"). */
  filename: string;
  /** yyyy-mm-dd from the file name; null when it has no date. */
  fileDate: string | null;
}

export function findObrasDataSet(html: string, baseUrl: string): InfobrasDataSetLink | null {
  for (const match of html.matchAll(/href\s*=\s*"([^"]*DownloadFile\?[^"]*)"/gi)) {
    const url = new URL(decodeEntities(match[1]!), baseUrl);
    const filename = url.searchParams.get("filename")?.trim();
    if (!filename || !/^DataSet-Obras-Publicas\b/i.test(filename)) continue;
    const date = /(\d{2})-(\d{2})-(\d{4})$/.exec(filename);
    return {
      url: url.toString(),
      filename,
      fileDate: date ? `${date[3]}-${date[2]}-${date[1]}` : null,
    };
  }
  return null;
}
