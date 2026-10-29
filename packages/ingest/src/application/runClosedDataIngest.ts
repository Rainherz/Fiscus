import { mapClosedDataRecord, type ClosedInvestment } from "../domain/closedData.js";
import {
  runSnapshotIngest,
  type SnapshotDataset,
  type SnapshotIngestInput,
  type SnapshotIngestSummary,
} from "./snapshotIngest.js";

/** source_snapshots key of CIERRE_INVERSIONES.csv. */
export const CLOSED_DATA_SOURCE = "mef_cierre_inversiones";

export type ClosedDataIngestSummary = SnapshotIngestSummary<"withClosureDate" | "withLiquidation" | "culminated">;

const CLOSED_DATASET: SnapshotDataset<ClosedInvestment, "withClosureDate" | "withLiquidation" | "culminated"> = {
  source: CLOSED_DATA_SOURCE,
  label: "closed data",
  map: mapClosedDataRecord,
  upsert: (repository, rows) => repository.upsertClosedInvestments(rows),
  counters: {
    withClosureDate: (row) => row.closedAt !== null,
    withLiquidation: (row) => row.liquidationAmount !== null,
    culminated: (row) => row.culminated === true,
  },
};

/**
 * Streams CIERRE_INVERSIONES.csv (closed investments) into the repository, with its own snapshot
 * (skip when unchanged, checked_at on every successful run). See runSnapshotIngest.
 */
export function runClosedDataIngest(input: SnapshotIngestInput): Promise<ClosedDataIngestSummary> {
  return runSnapshotIngest(CLOSED_DATASET, input);
}
