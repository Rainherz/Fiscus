import type { EditionLink } from "../domain/paralyzedEditions.js";
import type { ParalyzedRecord } from "../domain/paralyzedWorks.js";

/** An edition of the Contraloría report and its Anexo N° 01 spreadsheet. */
export interface ParalyzedEdition extends EditionLink {
  /** URL (or local path, for tests and manual runs) of the Anexo N° 01 spreadsheet. */
  xlsxUrl: string;
}

export interface ParalyzedWorksSource {
  /** The edition with the latest cut-off. Throws when none can be found. */
  latestEdition(): Promise<ParalyzedEdition>;
  /** Every data row of the edition's spreadsheet, keyed by normalized header. */
  records(edition: ParalyzedEdition): Promise<ParalyzedRecord[]>;
}
