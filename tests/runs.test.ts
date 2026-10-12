import { test } from "node:test";
import assert from "node:assert/strict";
import { runOutcome } from "../src/lib/format";

const at = "2026-10-12T00:00:00Z";

test("a run whose only errors are a throttled source is complete, with a note", () => {
  const o = runOutcome({
    status: "partial", // older runs were stored as partial for this
    errors: [
      { at, vc: "A", source: "gdelt", message: "GDELT: temporarily skipped after repeated rate limits" },
      { at, vc: "B", source: "gdelt", message: "fetch failed" },
    ],
  });
  assert.deepEqual(o, { status: "complete", note: "1 source rate-limited (GDELT)" });
});

test("no errors → complete, no note", () => {
  assert.deepEqual(runOutcome({ status: "success", errors: [] }), { status: "complete", note: null });
});

test("a VC that failed to update makes the run partial", () => {
  const o = runOutcome({
    status: "partial",
    errors: [
      { at, vc: "A", source: "gdelt", message: "HTTP 429 from api.gdeltproject.org" },
      { at, vc: "B", source: "score", message: "update_vc_signals(B): timeout" },
    ],
  });
  assert.deepEqual(o, { status: "partial", note: "1 VC not updated" });
});

test("failed and running pass through", () => {
  assert.equal(runOutcome({ status: "failed", errors: [] }).status, "failed");
  assert.equal(runOutcome({ status: "running", errors: [] }).status, "running");
});
