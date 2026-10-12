# Components Map

![Components Map](../public/components-map.svg)

The rendered SVG above is also served live at `/components-map.svg` and embedded on `/about`.

```mermaid
flowchart LR
  subgraph Triggers
    C1["Vercel Cron · ingest<br/>daily 06:00 IST"]
    C2["Vercel Cron · score<br/>Mon & Thu 07:00 IST"]
    RN["Run now button<br/>POST /api/run (ADMIN_TOKEN)"]
  end

  subgraph Sources["Live sources (free first)"]
    GN["Google News RSS<br/>person + firm-investment queries"]
    GD["GDELT DOC 2.0<br/>≤1 req / 5 s"]
    RS["Blog / Substack / Medium RSS"]
    FC["Firecrawl /search<br/>only if no active signal · 72h cache"]
    LI["LinkedIn via Apify<br/>(optional, APIFY_TOKEN)"]
  end

  subgraph Vercel["Vercel serverless (maxDuration 300s, chunked + self-chaining)"]
    IN["/api/cron/ingest<br/>URL + date required · dedupe md5(url)"]
    G1["Gemini Flash · classify<br/>is_about_vc · type · relevance · summary"]
    SC["/api/cron/score<br/>scoring.ts (deterministic)"]
    G2["Gemini Flash · next move<br/>≤30 words · template fallback"]
    UI["Dashboard (Next.js 15)<br/>/ · /runs · /about"]
  end

  subgraph Supabase["Supabase Postgres (RLS on, column GRANTs)"]
    SIG[("signals<br/>raw evidence, never deleted")]
    CACHE[("search_cache")]
    RUNS[("runs<br/>audit + manual-column fingerprint")]
    VCS[("vcs<br/>pipeline may UPDATE only 4 signal columns")]
  end

  V(["Vikram<br/>edits notes in Supabase Table Editor"])

  C1 --> IN
  C2 --> SC
  RN --> IN
  GN & GD & RS & FC & LI --> IN
  IN <--> G1
  G1 --> SIG
  FC <--> CACHE
  IN -- "full run" --> SC
  SIG --> SC
  SC <--> G2
  SC -- "RPC update_vc_signals()" --> VCS
  IN & SC --> RUNS
  VCS & SIG & RUNS --> UI
  V -- "manual columns" --> VCS
```

## Components

| Component | Responsibility | Code |
|---|---|---|
| Vercel Cron | Triggers ingest daily and score twice a week (Hobby: ≤ 1/day per cron) | `vercel.json` |
| Ingest route | Pulls live evidence for 5 VCs per invocation, re-invokes itself with the next cursor | `src/app/api/cron/ingest`, `src/lib/chain.ts`, `src/lib/runs.ts` |
| Sources | Google News RSS, GDELT, blog RSS, Firecrawl (fallback), LinkedIn (optional) | `src/lib/sources/*` |
| Gemini Flash | Classifies evidence (entity check, type, relevance, summary) and drafts the next move | `src/lib/gemini.ts` |
| Scoring | Deterministic score, bucket and explanation | `src/lib/scoring.ts` |
| Score route | Scores each VC, writes the 4 signal columns via RPC | `src/app/api/cron/score`, `src/lib/pipeline.ts` |
| Supabase | `vcs`, `signals`, `runs`, `search_cache`; column GRANTs protect manual columns | `supabase/schema.sql` |
| Dashboard | Public read-only view of the ranking, evidence, run log and method | `src/app/*` |
