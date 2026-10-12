# Pipeline Intel — VC outreach intelligence for a Seed-stage B2B logistics SaaS

> MESA Cohort C4 · Problem Statement 10

**Live:** https://vikram-b2b-saas-logistics.vercel.app · **Components Map + scoring rubric (PDF):** [`docs/pipeline-intel-method.pdf`](docs/pipeline-intel-method.pdf) · Mermaid source: [`docs/components-map.md`](docs/components-map.md)

## The problem

Vikram is a first-time founder raising a Seed round for a B2B logistics SaaS. He tracks ~50 VCs. Twice a week he needs to know **which VCs are worth reaching out to this week, and why**, based on an **observable signal from the past 30 days**: something they wrote, said in an interview, invested in or appeared at. He also needs to know **who has gone quiet**.

Every run updates his Supabase table so it's current when he opens it. The pipeline may update **only** `last_signal_date`, `signal_summary`, `follow_up_score` and `recommended_action`. It must **never** touch his contact history or personal notes.

## What it does

| | |
|---|---|
| **Reach out this week** | Score ≥ 60 **and** an active signal (≤ 30 days). Card shows the next move, why now, evidence links with dates, and the score math. |
| **Warm — watch** | Score 25–59, or only cooling (31–60 day) signals, or contacted too recently to nudge. |
| **Quiet — deprioritize** | No relevant observable signal in 60 days (`signal_summary = "No observable signal in last 60 days"`). |

The header shows the last run, VCs processed, new signals, Firecrawl credits used and **"Manual columns unchanged ✓"**. That last check is an md5 fingerprint of all manual columns taken before and after each run.

## Architecture

![Components Map](public/components-map.svg)

- **Next.js 15** (App Router, TypeScript, Tailwind v4) on **Vercel** (Hobby).
- **Supabase** Postgres: `vcs` (Vikram's table), `signals` (raw evidence, never deleted), `runs` (audit log), `search_cache` (Firecrawl 72h cache).
- **Gemini Flash** for all AI, via `@google/genai` with JSON `responseSchema`. It only *classifies* fetched evidence and drafts the next move. It never searches or recalls facts from memory.
- **Vercel Cron:** `/api/cron/ingest` daily at 00:30 UTC (06:00 IST) and `/api/cron/score` Mon & Thu at 01:30 UTC (07:00 IST). Both require `Authorization: Bearer $CRON_SECRET`.
- **Chunking:** each invocation processes 5 VCs (ingest) or 25 (score), does the work in `after()`, then calls itself with the next cursor. No invocation comes near the 300 s limit.
- **Run now:** `POST /api/run` (Bearer `ADMIN_TOKEN`) runs a full ingest → score from the dashboard.
- **UI:** light editorial design system documented in [`DESIGN.md`](DESIGN.md): warm cream canvas, ink pills, Sofia Sans. Motion uses Lenis smooth scroll on the GSAP ticker, GSAP ScrollTrigger reveals and hero timeline, React Bits `BlurText`/`SpotlightCard`, motion-primitives `AnimatedNumber`/`AnimatedBackground`, and one lazy Vanta NET backdrop. All of it respects `prefers-reduced-motion`.

```
src/
  app/            page.tsx (dashboard) · runs/ · about/ · api/{cron/ingest,cron/score,run,status}
  components/     Board, VcCard, RunNow, ui primitives
  lib/
    sources/      googleNews.ts · gdelt.ts · rss.ts · firecrawl.ts · linkedin.ts · util.ts
    gemini.ts     classification + recommended action (Flash fallback chain, concurrency 2, 429 backoff)
    scoring.ts    deterministic score / bucket / explanation (unit-tested)
    pipeline.ts   ingestVc() and scoreAndWrite()
    runs.ts       run lifecycle, chunk steps, fingerprint before/after
    chain.ts      cron auth + self-chaining
supabase/schema.sql · scripts/seed.ts · scripts/run-pipeline.ts · tests/scoring.test.ts
```

## Sources (all live, free first)

| Source | How | Notes |
|---|---|---|
| Google News RSS | `("Name" OR "Nick") "Firm" when:60d`, plus a firm-deals query `"Firm" (invests OR "led by" OR raises) when:60d` | No key. Firm-deal results are capped at the 8 newest per firm. |
| GDELT DOC 2.0 | `"Name" "Firm"`, `timespan=60d`, `ArtList` JSON | No key. Serialised to ≥ 1 request / 6 s, with a circuit breaker on repeated 429s. |
| Blog / Substack / Medium RSS | `vcs.blog_rss` (RSS or Atom) | Uses the item `pubDate`. Personal feeds are tagged "own blog", firm feeds "firm blog". |
| Firecrawl `/search` | `"Name" Firm`, news + web, custom 60-day date range, limit 10 | **Only** for VCs where the free sources found no active signal. Cached 72h in `search_cache`, credits tracked in `runs.firecrawl_credits`. |
| LinkedIn (optional source) | Apify `harvestapi/linkedin-profile-posts` | **OFF** unless `APIFY_TOKEN` is set. Scraping LinkedIn may conflict with LinkedIn's ToS, so it's feature-flagged and not needed for the core flow. |

Every candidate must have a real URL and a parseable published date, or it's dropped. Dates are never inferred by AI. Dedupe is by `(vc_id, md5(url))`, enforced by a unique index.

## Gemini Flash usage

1. **Classify** (batches of ≤ 8): `is_about_vc` (name **and** firm context, namesakes rejected), `signal_type`, `relevance` 0–1 to logistics / supply chain / B2B SaaS / India seed, and a `summary` of ≤ 25 words from the given text only.
2. **Recommended action** (one call per VC with a signal in Reach-out/Warm): ≤ 30 words, cites the top signal, tailored to `contact_status`. A deterministic template is used if Gemini fails, or for Quiet VCs.
3. **Model chain:** `GEMINI_MODEL` → `gemini-3.6-flash` → `gemini-3-flash-preview`. Concurrency 2, exponential backoff on 429/5xx, and a 404 model is skipped.
4. Items Gemini fails to classify are **not stored**, so they're retried next run. Unclassified evidence never becomes a signal.

## Scoring (deterministic, shown on the dashboard)

```
type_weight: investment 1.0, blog_post 0.9, interview 0.9, event 0.8, social_post 0.6, news_mention 0.5, other 0.3
recency(age): 0–30 → 1.0 − 0.3·(age/30) ; 31–60 → 0.4 − 0.3·((age−30)/30) ; >60 → 0
signal_value = relevance × type_weight × recency          (only is_about_vc = true)
base = max(signal_value) + min(0.15, 0.05 × (active_count − 1))
status: passed → 0 ; waiting_for_response & last_contact < 7d → cap 0.40 ("give them time")
        waiting_for_response & last_contact ≥ 14d & active signal → +0.10 ("nudge, reference signal")
follow_up_score = round(100 × clamp(base, 0, 1))
bucket: ≥ 60 AND active (≤30d) → Reach out this week ; 25–59 or only cooling → Warm — watch ; else Quiet — deprioritize
```

`last_signal_date` is the newest relevant signal of any age. `signal_summary` is the top 1–2 summaries with dates. Each card has a "How this score was computed" panel with its own numbers. `npm test` covers the formula (10 cases).

## The 30 / 60-day windows

- **0–30 days = Active.** Only these can put a VC in "Reach out this week". This is the brief's 30-day rule, applied literally.
- **31–60 days = Cooling.** Shown with a lower score as "Warm — watch". A deal from 6 weeks ago is context, not a reason to email today.
- **> 60 days = History.** Kept forever in `signals`, used for `last_signal_date`, never scored.

Why look back 60 days if only 30 count? Investors post in bursts, so the cooling list shows who is likely to resurface. The overlap also means a source being down for a day doesn't lose signals.

## Protecting Vikram's notes (three layers)

1. **Postgres column privileges:** `service_role` may `UPDATE` only the 4 signal columns. `update vcs set personal_notes = 'x'` as `service_role` fails with `permission denied for table vcs` (verified).
2. **Single write path:** all `vcs` writes go through the `update_vc_signals()` RPC. Seeding is insert-only (`ON CONFLICT DO NOTHING`).
3. **Proof per run:** `manual_columns_fingerprint()` runs before and after, the result is stored in `runs.protected_check`, and the dashboard shows "Manual columns unchanged ✓".

Vikram can edit his notes, status and last-contact date **in the app** (the "Edit" button on each card) or in the Supabase Table Editor. In-app edits go through a separate `SECURITY DEFINER` function, `update_vc_manual()`, called only by `POST /api/notes` (admin token). A guardrail test fails the build if any other file references it. The pipeline's key still physically can't write those columns.

## Outreach (email + LinkedIn + personalised deck)

Every card has a **Draft outreach** button that opens a panel with:

- **To:** the best address *published on the firm's own website*. It's copied verbatim from `mailto:` links, page text or Cloudflare-obfuscated addresses, in this order of preference: the person's own address, then the pitch inbox, then the general inbox. Nothing is guessed. 18/50 investors have one; the field stays editable for the rest. Source: `npm run contacts` (`scripts/find-contacts.ts`), stored in `contacts`.
- **Email draft:** written by Gemini Flash from the investor's top signal under strict style rules (60–120 words, plain verbs, no flattery). A linter then rejects AI tells: "hope this finds you", "reaching out", "excited", "leverage", em dashes, exclamation marks, over-length. It only claims a link to Freightlane when the signal supports one; otherwise it says plainly why it's writing. If Gemini fails the linter twice, a hand-written template is used. Founder facts live in `src/lib/outreach/founder.ts`; unknown numbers stay as `[placeholders]`, and **Send is blocked until they're filled**, so no invented traction reaches a real investor.
- **Attached deck:** an illustrative 8-slide PDF (`pdf-lib`) whose **cover is personalised**: "Prepared for {name} · {title} · {firm}", the firm's real logo (from its site, on an ink chip if the logo is white) and the firm's accent colour as a band, in Freightlane's own style. The panel previews that first slide. `GET /api/deck/{vcId}`.
- **Send:** *Create Gmail draft* (deck attached, opens in Gmail) or *Send now*, both through the Gmail API with an OAuth refresh token and the admin token. Without Gmail connected, *Download .eml* gives a draft with the attachment that opens in Outlook or Apple Mail.
- **LinkedIn box:** the person's profile card with *Open profile*, and a connection note under 300 characters with *Copy*. LinkedIn has no API for sending messages, so Vikram pastes it.

Connect Gmail (one time): enable the Gmail API in Google Cloud, set the OAuth consent screen to Testing with Vikram as a test user, create a **Desktop** OAuth client, put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`, then run `npm run gmail:auth`. It writes `GOOGLE_REFRESH_TOKEN`. Add all three to Vercel env.

## How to run

```bash
npm install
cp .env.example .env.local     # fill in keys (never commit)
# Supabase → SQL Editor → run supabase/schema.sql
npm run seed                   # 50 verified investors, insert-only
npm test                       # scoring unit tests
npm run pipeline               # full ingest → score, in-process (no time limit)
npm run dev                    # http://localhost:3000
```

Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `FIRECRAWL_API_KEY`, `CRON_SECRET`, `ADMIN_TOKEN`, `SIGNAL_LOOKBACK_DAYS=60`, `ACTIVE_WINDOW_DAYS=30`, `APIFY_TOKEN` (optional).

Trigger a cron chunk manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/ingest
```

## Blockers and fixes

| Blocker | Fix |
|---|---|
| Gemini Google Search grounding isn't on the free tier | Gemini only classifies fetched evidence. Search goes through RSS, GDELT and Firecrawl. |
| Namesakes / generic firm names ("Accel (India)", "Z47 (formerly Matrix)") | Query name + firm together, strip parentheticals, search former names too, and gate on Gemini `is_about_vc`. |
| Hallucinated signals | URL + published date must come from the source. Unclassified items aren't stored. |
| Firecrawl credit cap (1,000/month) | Free sources first. Firecrawl only runs for VCs with no active signal, with a 72h cache and credits logged per run. |
| GDELT throttling (strict 1 req / 5 s per IP, frequent 429s) | Serialised gate, one retry, a circuit breaker after repeated 429s, and failure is non-fatal (logged to `runs.errors`). |
| Gemini free-tier RPM | Batches of 8, concurrency 2, backoff honouring `retryDelay`, a model fallback chain, and a template fallback for actions. |
| Vercel Hobby limits (cron ≤ 1/day, 300 s) | Two daily-or-less crons. Chunked steps run in `after()` and self-chain with a cursor. |
| Overwriting notes | Column GRANTs + single RPC + fingerprint check. |
| TypeScript 7 (native) incompatible with Next 15's build | Pinned `typescript@5`. |
| Machine-level `GEMINI_API_KEY` shadowed `.env.local` (dotenv/Next never override) → 401 | Scripts load `.env.local` with `override: true`; the dev server starts with the stale variable cleared. |
| Gemini first rubric capped relevance at ~0.4 → nobody reached "Reach out" | Banded relevance rubric, re-labelled stored signals in place (`scripts/reclassify.ts`), no deletions. |
| Same deal covered by several outlets showed twice | Story-level de-duplication (`storyKey`), unit-tested. |
| Gemini guessed gendered pronouns for real people | Prompt rule plus re-label; a DB check shows 0 remaining. |
| Apollo free plan blocks enrichment and people search over the API/MCP (0 credits spent) | Emails copied verbatim from firms' own sites; the `contacts` table accepts Apollo rows if the plan is upgraded. |
| LinkedIn has no message API (and automation breaks its ToS) | Draft-and-copy box with an open-profile link. |
| Vercel env values added via PowerShell got a trailing newline (`CRON_SECRET` rejected) | Re-set with `vercel env update` from newline-free input. |
| White logos vanished on the deck's white chip | Logo luminance measured with `sharp`, light-on-dark logos get an ink chip. |

## Deliverables checklist

- [x] `schema.sql` applied, permission test fails as expected
- [x] 50 VCs seeded
- [x] Live URL shows real signals with source links and dates
- [x] Manual-column protection proven on production: edited Sajith Pai's note in Supabase → score cron (Vercel, chained chunks, 173 s) → note unchanged, fingerprint before = after ✓
- [x] `vercel.json` crons present; cron routes return 401 without the secret
- [x] `grep -ri "anthropic\|openai" src package.json` returns nothing (also enforced by `tests/guardrails.test.ts`)
- [x] README
- [x] Components Map: `docs/pipeline-intel-method.pdf` (map + scoring rubric) and `docs/components-map.md` (Mermaid + SVG)
- [x] No secrets in git history
