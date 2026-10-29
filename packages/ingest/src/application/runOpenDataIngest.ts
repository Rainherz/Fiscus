import { mapOpenDataRecord, type OpenDataInvestment } from "../domain/openData.js";
import {
  runSnapshotIngest,
  type SnapshotDataset,
  type SnapshotIngestInput,
  type SnapshotIngestSummary,
} from "./snapshotIngest.js";

/** source_snapshots key of DETALLE_INVERSIONES.csv. */
export const OPEN_DATA_SOURCE = "mef_detalle_inversiones";

export type RunOpenDataIngestInput = SnapshotIngestInput;

export type OpenDataIngestSummary = SnapshotIngestSummary<"withPhysicalProgress">;

const ACTIVE_DATASET: SnapshotDataset<OpenDataInvestment, "withPhysicalProgress"> = {
  source: OPEN_DATA_SOURCE,
  label: "open data",
  map: mapOpenDataRecord,
  upsert: (repository, rows) => repository.upsertOpenDataInvestments(rows),
  counters: { withPhysicalProgress: (row) => row.physicalProgress !== null },
};

/** Streams DETALLE_INVERSIONES.csv (active investments) into the repository (see runSnapshotIngest). */
export function runOpenDataIngest(input: RunOpenDataIngestInput): Promise<OpenDataIngestSummary> {
  return runSnapshotIngest(ACTIVE_DATASET, input);
}
