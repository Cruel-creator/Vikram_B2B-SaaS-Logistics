import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSignalSummary, NO_SIGNAL_SUMMARY, recency, scoreVc, type ScoreSignal } from "../src/lib/scoring";

const NOW = new Date("2026-10-11T06:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
let n = 0;
const sig = (p: Partial<ScoreSignal> & { age: number }): ScoreSignal => ({
  url: `https://example.com/${n++}`,
  title: "t",
  summary: "s",
  signal_type: "investment",
  relevance: 1,
  is_about_vc: true,
  published_at: ago(p.age),
  ...p,
});

test("recency curve matches the brief", () => {
  assert.equal(recency(0), 1);
  assert.ok(Math.abs(recency(30) - 0.7) < 1e-9);
  assert.ok(Math.abs(recency(31) - (0.4 - 0.3 / 30)) < 1e-9);
  assert.ok(Math.abs(recency(60) - 0.1) < 1e-9);
  assert.equal(recency(61), 0);
});

test("fresh relevant investment → Reach out this week", () => {
  const r = scoreVc({ status: "yet_to_reach_out", lastContactDate: null, signals: [sig({ age: 3 })], now: NOW });
  assert.equal(r.score, 97);
  assert.equal(r.bucket, "reach_out");
  assert.equal(r.activeCount, 1);
});

test("momentum bonus caps at +0.15", () => {
  const signals = [0, 1, 2, 3, 4, 5].map((a) => sig({ age: a + 10, relevance: 0.5 }));
  const r = scoreVc({ status: "yet_to_reach_out", lastContactDate: null, signals, now: NOW });
  // top = 0.5 × 1.0 × (1 − 0.3·10/30) = 0.45, + 0.15
  assert.equal(r.score, 60);
});

test("only cooling signals → Warm, never Reach out", () => {
  const r = scoreVc({ status: "yet_to_reach_out", lastContactDate: null, signals: [sig({ age: 40 })], now: NOW });
  assert.equal(r.activeCount, 0);
  assert.equal(r.bucket, "warm");
  assert.ok(r.score < 60);
});

test("namesakes (is_about_vc=false) are ignored", () => {
  const r = scoreVc({
    status: "yet_to_reach_out",
    lastContactDate: null,
    signals: [sig({ age: 1, is_about_vc: false })],
    now: NOW,
  });
  assert.equal(r.score, 0);
  assert.equal(r.bucket, "quiet");
  assert.equal(r.lastSignalDate, null);
});

test("waiting & contacted < 7d → capped at 40 (give them time)", () => {
  const r = scoreVc({ status: "waiting_for_response", lastContactDate: ago(3), signals: [sig({ age: 2 })], now: NOW });
  assert.equal(r.score, 40);
  assert.equal(r.statusRule, "give_time");
  assert.equal(r.bucket, "warm");
});

test("waiting ≥ 14d with active signal → +0.10 nudge", () => {
  const r = scoreVc({
    status: "waiting_for_response",
    lastContactDate: ago(20),
    signals: [sig({ age: 15, relevance: 0.6 })],
    now: NOW,
  });
  // 0.6 × 1.0 × 0.85 = 0.51 + 0.10
  assert.equal(r.score, 61);
  assert.equal(r.statusRule, "nudge");
  assert.equal(r.bucket, "reach_out");
});

test("passed → 0 and quiet", () => {
  const r = scoreVc({ status: "passed", lastContactDate: ago(30), signals: [sig({ age: 1 })], now: NOW });
  assert.equal(r.score, 0);
  assert.equal(r.bucket, "quiet");
});

test(">60d signals count for last_signal_date but not score", () => {
  const r = scoreVc({ status: "yet_to_reach_out", lastContactDate: null, signals: [sig({ age: 75 })], now: NOW });
  assert.equal(r.score, 0);
  assert.equal(r.bucket, "quiet");
  assert.equal(r.lastSignalDate, ago(75).slice(0, 10));
  assert.equal(buildSignalSummary(r.scored), NO_SIGNAL_SUMMARY);
});

test("same story from two outlets collapses to one; different deals stay separate", () => {
  const r = scoreVc({
    status: "yet_to_reach_out",
    lastContactDate: null,
    signals: [
      sig({ age: 3, summary: "Polygrade raised $6.3 million to rebuild warranty claims with AI." }),
      sig({ age: 4, summary: "Polygrade raised $6.3 million for its AI-powered warranty claims platform." }),
      sig({ age: 5, summary: "Torch Systems raised $11.5 million to scale AI infrastructure monitoring." }),
    ],
    now: NOW,
  });
  const s = buildSignalSummary(r.scored, ["Dayna Grayson", "Construct Capital"]);
  assert.equal((s.match(/Polygrade/g) ?? []).length, 1);
  assert.match(s, /Torch Systems/);
});

test("signal summary has top 1–2 with dates", () => {
  const r = scoreVc({
    status: "yet_to_reach_out",
    lastContactDate: null,
    signals: [
      sig({ age: 2, summary: "Led seed in FreightCo" }),
      sig({ age: 9, summary: "Wrote on India SaaS", signal_type: "blog_post" }),
      sig({ age: 20, summary: "third" }),
    ],
    now: NOW,
  });
  const s = buildSignalSummary(r.scored);
  assert.match(s, /Led seed in FreightCo/);
  assert.match(s, /Wrote on India SaaS/);
  assert.doesNotMatch(s, /third/);
});
