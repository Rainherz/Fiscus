import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  evaluateFreshness,
  parseFreshnessRows,
  planStaleIssue,
  STALE_ISSUE_LABEL,
  STALE_ISSUE_TITLE,
  type StaleIssueAction,
} from "./freshness.js";
import { parseFreshnessCliConfig } from "./freshnessCliConfig.js";

const run = promisify(execFile);

/** gh reads GH_TOKEN (GITHUB_TOKEN in Actions) and the repository from GH_REPO or the checkout. */
async function gh(args: string[]): Promise<string> {
  const { stdout } = await run("gh", args);
  return stdout;
}

async function openStaleIssue(): Promise<number | null> {
  const json = await gh([
    "issue", "list", "--state", "open", "--label", STALE_ISSUE_LABEL,
    "--search", `in:title "${STALE_ISSUE_TITLE}"`, "--json", "number,title",
  ]);
  const issues = JSON.parse(json) as Array<{ number: number; title: string }>;
  return issues.find((issue) => issue.title === STALE_ISSUE_TITLE)?.number ?? null;
}

async function apply(action: StaleIssueAction): Promise<void> {
  switch (action.kind) {
    case "none":
      return;
    case "open":
      await gh(["label", "create", STALE_ISSUE_LABEL, "--color", "FFC20E", "--description", "Datos sin actualizar", "--force"]);
      await gh(["issue", "create", "--title", action.title, "--label", STALE_ISSUE_LABEL, "--body", action.body]);
      return;
    case "update":
      await gh(["issue", "edit", String(action.issue), "--body", action.body]);
      return;
    case "close":
      await gh(["issue", "close", String(action.issue), "--comment", action.comment]);
      return;
  }
}

async function main(): Promise<number> {
  const config = parseFreshnessCliConfig(process.argv.slice(2), process.env);
  const response = await fetch(`${config.supabaseUrl}/rest/v1/data_freshness?select=source,last_success_at,last_checked_at`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
  });
  if (!response.ok) throw new Error(`data_freshness read failed: HTTP ${response.status}`);
  const evaluation = evaluateFreshness(parseFreshnessRows(await response.json()), new Date(), {
    maxAgeHours: config.maxAgeHours,
  });
  console.log(JSON.stringify(evaluation, null, 2));

  const action = planStaleIssue(evaluation, config.dryRun ? null : await openStaleIssue(), { runUrl: config.runUrl });
  console.log(`issue action: ${action.kind}${"issue" in action ? ` #${action.issue}` : ""}`);
  if (!config.dryRun) await apply(action);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
