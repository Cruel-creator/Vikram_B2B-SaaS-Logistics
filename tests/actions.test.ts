import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ACTION_WORDS, templateAction } from "../src/lib/gemini";
import type { ScoredSignal } from "../src/lib/scoring";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

// A 25-word summary (the classifier's maximum) — previously pushed the template to 31 words.
const longSummary =
  "Elizabeth Yin passed on investing in RedDrop due to a conflict of interest from backing competitors Aunt Flow and Ruby Love last month.";

const top = {
  url: "https://example.com/a",
  title: null,
  summary: longSummary,
  signal_type: "news_mention",
  relevance: 0.3,
  is_about_vc: true,
  published_at: "2026-09-28T00:00:00Z",
  ageDays: 14,
  recency: 0.86,
  weight: 0.5,
  value: 0.13,
  window: "active",
} satisfies ScoredSignal;

test("template actions never exceed the brief's 30-word cap", () => {
  for (const contact_status of ["yet_to_reach_out", "waiting_for_response", "in_conversation", "passed"] as const) {
    for (const bucket of ["reach_out", "warm", "quiet"]) {
      for (const contactAgeDays of [3, 20, null]) {
        const a = templateAction({ vc: { name: "Elizabeth Yin", contact_status }, top, bucket, contactAgeDays });
        assert.ok(words(a) <= MAX_ACTION_WORDS, `${words(a)} words: ${a}`);
        assert.doesNotMatch(a, /…\./);
      }
    }
  }
});

test("short summaries are quoted in full", () => {
  const a = templateAction({
    vc: { name: "Sajith Pai", contact_status: "yet_to_reach_out" },
    top: { ...top, summary: "Wrote about the ILOS principle." },
    bucket: "reach_out",
    contactAgeDays: null,
  });
  assert.equal(a, "Cold-email Sajith this week, opening with: Wrote about the ILOS principle. Tie it to your logistics SaaS traction.");
});
