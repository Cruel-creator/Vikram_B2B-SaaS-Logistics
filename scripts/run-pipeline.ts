/**
 * Run the full pipeline in-process (no serverless time limit) — for local testing.
 *
 *   npm run pipeline            # full: ingest → score
 *   npm run pipeline -- score   # score only
 *   npm run pipeline -- ingest  # ingest only
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { lastModelUsed } from "../src/lib/gemini";
import { runToCompletion } from "../src/lib/runs";

const kind = (process.argv[2] as "full" | "ingest" | "score") ?? "full";

runToCompletion(kind, "manual")
  .then((run) => {
    console.log("\nRun finished:");
    console.log({
      id: run.id,
      status: run.status,
      vcs_processed: run.vcs_processed,
      signals_new: run.signals_new,
      firecrawl_credits: run.firecrawl_credits,
      protected_check: run.protected_check,
      gemini_model: lastModelUsed,
      errors: run.errors.length,
    });
    for (const e of run.errors.slice(0, 15)) console.log(`  ! [${e.source}] ${e.vc ?? ""} ${e.message}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
