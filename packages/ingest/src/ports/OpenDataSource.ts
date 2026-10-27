import type { OpenDataCsvRecord } from "../domain/openData.js";

/** What identifies a version of the published file, without downloading it. */
export interface OpenDataFileInfo {
  /** ISO timestamp (HTTP Last-Modified); null when unknown. */
  lastModified: string | null;
  /** Bytes (HTTP Content-Length); null when unknown. */
  contentLength: number | null;
}

export interface OpenDataSource {
  describe(): Promise<OpenDataFileInfo>;
  /** Streams the rows of the file, one record at a time (never the whole file in memory). */
  records(): AsyncIterable<OpenDataCsvRecord>;
}
