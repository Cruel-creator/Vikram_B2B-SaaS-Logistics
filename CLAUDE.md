# VC Pipeline Intelligence — build brief for Claude Code

Graded assessment (MESA Cohort C4, Problem Statement 10). Every decision below is made to satisfy the grader literally. Do not drift from the brief.

## The brief (non-negotiable)
- Vikram, a first-time founder raising Seed for a B2B logistics SaaS, tracks ~50 VCs.
- Twice a week, tell him **which VCs are worth reaching out to this week and why**, based on an **observable signal from the past 30 days**: something they wrote, said in an interview, invested in, or appeared at. Also flag who is **quiet**.
- Every run updates his **Supabase** table so it's current when he opens it.
- **Update ONLY**: `last_signal_date`, `signal_summary`, `follow_up_score`, `recommended_action`. **Never touch** contact history or personal notes.
- Rules: live external data; **all AI = Gemini Flash** (no Claude/OpenAI SDKs anywhere in the repo); deploy on **Vercel**. Submit public URL + GitHub repo + **Components Map**.

## Stack and accounts
- Next.js 15 (App Router, TypeScript, Tailwind), deployed to Vercel (Hobby).
- Supabase project `dtbzdggwehqoghmcwnzm` → `https://dtbzdggwehqoghmcwnzm.supabase.co`
- GitHub: https://github.com/Cruel-creator/Vikram_B2B-SaaS-Logistics (empty, `main`).
- Deps: `@supabase/supabase-js`, `@google/genai`, `@mendable/firecrawl-js`, `fast-xml-parser`, `zod`.

### Env vars (`.env.local` locally, Vercel project env in prod — NEVER commit)
```
NEXT_PUBLIC_SUPABASE_URL=https://dtbzdggwehqoghmcwnzm.supabase.co
SUPABASE_SECRET_KEY=            # sb_secret_… or legacy service_role (server only)
GEMINI_API_KEY=                 # note: key in the notes file is wrapped over 2 lines — join them
GEMINI_MODEL=gemini-3.8-flash   # free-tier Flash; code falls back to gemini-3.6-flash
FIRECRAWL_API_KEY=
CRON_SECRET=                    # random string; Vercel sends it as Bearer on cron calls
ADMIN_TOKEN=                    # protects the manual "Run now" endpoint
SIGNAL_LOOKBACK_DAYS=60
ACTIVE_WINDOW_DAYS=30
APIFY_TOKEN=                    # optional; LinkedIn source is OFF unless set
```
`.gitignore` must include `.env*`. Run a secret scan (`git grep -nE "AIza|AQ\.|fc-|sb_secret|eyJhbGci"`) before every push.

## Database
`supabase/schema.sql` (already written) — run it in the Supabase SQL Editor first. Key points:
- `vcs` (manual + 4 signal columns), `signals` (raw evidence, never deleted), `runs` (audit log).
- **Column privileges**: `service_role` can UPDATE only the 4 signal columns → a code bug physically cannot overwrite notes.
- All vcs writes go through RPC `update_vc_signals(...)`.
- `manual_columns_fingerprint()` is called before and after every run; result stored in `runs.protected_check` and shown on the dashboard as "Manual columns unchanged ✓".
- Seed from `data/vc_seed.json` (50 verified real investors) with `scripts/seed.ts`. Fill manual columns with clearly-labelled demo values (`personal_notes` prefixed `[demo]`, mix of `yet_to_reach_out` / `waiting_for_response`, varied `last_contact_date`). Upsert on `(name, firm)` with **insert-only** semantics (`ignoreDuplicates: true`) so reseeding never touches manual columns.

## Pipeline

### Signal window (user decision)
- Look back **60 days** (`SIGNAL_LOOKBACK_DAYS`), keep every signal forever.
- **0–30 days = Active** → only these can put a VC in "Reach out this week" (brief's 30-day rule).
- **31–60 days = Cooling** → shown, lower score, "warm — watch".
- **>60 days** → history only, not scored.

### Sources (free, live)
| Source | How | Notes |
|---|---|---|
| Google News RSS | `https://news.google.com/rss/search?q="{name}" "{firm}"+when:60d&hl=en-IN&gl=IN&ceid=IN:en` | No key. Also a firm-only query for investments: `"{firm}" (invests OR "led by" OR raises) when:60d`. |
| GDELT DOC 2.0 | `https://api.gdeltproject.org/api/v2/doc/doc?query="{name}"&mode=ArtList&format=json&timespan=60d&maxrecords=50` | No key, 15-min updates, 3-month max window. Rate-limit politely (≥1 req / 5s). |
| Blog/Substack/Medium RSS | `vcs.blog_rss` | Use item `pubDate`. |
| Firecrawl `/search` | query `"{name}" {firm}`, limit 10, time filter for last 60 days | Free tier = 1,000 credits/month (~2 credits per search). Only call for VCs where the free sources found **no active signal**, cache by query for 72h. Track credits in `runs`. |
| LinkedIn (optional) | Apify actor `harvestapi/linkedin-profile-posts`, `postedLimitDate` = 60 days ago | Feature-flagged on `APIFY_TOKEN` + `linkedin_url`. Label "optional source" in README (LinkedIn ToS). |

Every candidate must have a real URL and a parseable published date, else drop it. Dedupe by `(vc_id, md5(url))`.

### Gemini Flash (classification only — never searching from memory)
Batch up to ~8 candidates per call, `responseMimeType: application/json` + `responseSchema`. For each item return:
`is_about_vc` (bool — name AND firm context match; reject namesakes), `signal_type` (blog_post|interview|investment|event|social_post|news_mention|other), `relevance` 0–1 to logistics / supply chain / B2B SaaS / India seed, `summary` (≤25 words, factual, from the given text only).
Then one call per VC for `recommended_action` (≤30 words, cites the top signal, tailored to `contact_status`). Template fallback if Gemini fails.
Throttle (free-tier RPM): concurrency 2, exponential backoff on 429. Model fallback chain: `GEMINI_MODEL` → `gemini-3.6-flash` → `gemini-3-flash-preview`.

### Scoring (deterministic, explainable — show the formula on the dashboard)
```
type_weight: investment 1.0, blog_post 0.9, interview 0.9, event 0.8, social_post 0.6, news_mention 0.5, other 0.3
recency(age_days): 0–30 → 1.0 − 0.3·(age/30) ; 31–60 → 0.4 − 0.3·((age−30)/30) ; >60 → 0
signal_value = relevance × type_weight × recency          (only is_about_vc = true)
base = max(signal_value) + min(0.15, 0.05 × (active_count − 1))
status: passed → 0 ; waiting_for_response & last_contact < 7d → cap 0.40 ("give them time")
        waiting_for_response & last_contact ≥ 14d & active signal → +0.10 ("nudge, reference signal")
follow_up_score = round(100 × clamp(base, 0, 1))
bucket: score ≥ 60 AND an active (≤30d) signal → "Reach out this week"
        25–59 or only cooling signals → "Warm — watch"
        otherwise → "Quiet — deprioritize"  (signal_summary = "No observable signal in last 60 days")
```
`last_signal_date` = newest relevant signal's date (any age); `signal_summary` = top 1–2 signal summaries with dates.

### Vercel limits → design
- Hobby cron = max once/day, ±59 min. Two crons in `vercel.json`:
  - `/api/cron/ingest` daily `30 0 * * *` (06:00 IST) → collect + classify new signals.
  - `/api/cron/score` Mon & Thu `30 1 * * 1,4` (07:00 IST) → recompute + write 4 columns.
- Both verify `Authorization: Bearer ${CRON_SECRET}`. Set `export const maxDuration = 300`.
- Process VCs in chunks (e.g. 10 per invocation) with a cursor; ingest route self-continues by calling itself with the next cursor, or `?offset=` loop, so no single invocation exceeds the limit.
- `POST /api/run` (ADMIN_TOKEN) for the dashboard "Run now" button.

## Dashboard (public URL — this is what the grader sees)
- Header: last run time, status, VCs processed, new signals, **"Manual columns unchanged ✓"** from `protected_check`.
- Three sections: **Reach out this week** (ranked by score), **Warm — watch**, **Quiet — deprioritize**.
- Each VC card: name, firm, status, score, recommended action, signal summary, evidence links (title, source, date, type badge, Active/Cooling tag), plus Vikram's notes shown **read-only**.
- `/runs` page: run log. `/about` page: how scoring works + the Components Map.
- Notes are edited in Supabase Table Editor (the brief's "his Supabase table"), not in the app.

## Deliverables checklist
- [ ] `schema.sql` applied, 50 VCs seeded, permission test fails as expected (see bottom of schema.sql)
- [ ] Live URL shows real signals with source links and dates
- [ ] Manual-column protection proven: edit a note in Supabase → Run now → note unchanged, fingerprint ✓
- [ ] `vercel.json` crons present; cron routes reject requests without the secret
- [ ] `grep -ri "anthropic\|openai" src package.json` returns nothing
- [ ] README: problem, architecture, sources, scoring, 30/60-day reasoning, blockers & fixes, how to run
- [ ] Components Map (`docs/components-map.md` with Mermaid + rendered PNG/SVG)
- [ ] No secrets in git history

## Known blockers and fixes
| Blocker | Fix |
|---|---|
| Gemini Google Search grounding is not on the free tier | Gemini only classifies fetched evidence; search via RSS/GDELT/Firecrawl |
| Namesakes / generic firm names | Query name + firm together; Gemini `is_about_vc` gate |
| Hallucinated signals | Require URL + published date from the source, never from Gemini |
| Firecrawl credit cap | Free sources first; Firecrawl only for VCs with no active signal; 72h cache |
| Google News / GDELT throttling | Polite delays, retries, cache; either source failing is non-fatal (log to `runs.errors`) |
| Vercel timeouts | Chunked processing with cursor |
| Overwriting notes | Column GRANTs + RPC + fingerprint check |
