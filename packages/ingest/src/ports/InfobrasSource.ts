import type { InfobrasDataSetLink } from "../domain/infobrasDataSets.js";
import type { InfobrasRecord } from "../domain/infobrasWorks.js";

/** The dataset downloaded to a local temporary file. */
export interface DownloadedDataSet {
  path: string;
  bytes: number;
  /** Deletes the temporary file. */
  cleanup(): Promise<void>;
}

export interface InfobrasSource {
  /** The current obras dataset linked from the DataSets page. Throws when none is linked. */
  latestDataSet(): Promise<InfobrasDataSetLink>;
  /**
   * Downloads the dataset to a temporary file. Returns null without downloading the body when the
   * response's Content-Length equals skipIfLength (the same file as the last ingest).
   */
  download(link: InfobrasDataSetLink, options?: { skipIfLength?: number | null }): Promise<DownloadedDataSet | null>;
  /** Data rows of a downloaded dataset, only the kept columns, streamed. */
  records(path: string): AsyncIterable<InfobrasRecord>;
}
