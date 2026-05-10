# Pangolin v2 — Micro-SaaS Idea Discovery Tool

## What This Builds

A clean-slate Next.js app that turns Upwork job listings into a prioritized feed of micro-SaaS product ideas, with AI extraction, deterministic viability scoring, tagging, and trend signals over time.

---

## Core Concept

Every Upwork listing is a potential signal. Someone is describing a pain point and willing to pay to solve it. The goal is to surface listings where that pain point could be solved by a software product — not a freelancer engagement — and score them by how viable that product opportunity is.

The unit of value is the **Idea**: a processed listing annotated with pain/solution fields, a viability score, tags, and a status (inbox / saved / dismissed).

---

## Data Model

### `ideas` table

```sql
CREATE TABLE ideas (
  id                    SERIAL PRIMARY KEY,
  upwork_url            TEXT UNIQUE,
  title                 TEXT NOT NULL,
  description           TEXT,
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at             TIMESTAMPTZ,
  source                TEXT NOT NULL DEFAULT 'batch' CHECK (source IN ('batch', 'single')),

  -- Raw signals
  vertical              TEXT,
  tools_mentioned       TEXT[],
  skills                TEXT[],
  budget_type           TEXT CHECK (budget_type IN ('fixed', 'hourly')),
  budget_min            NUMERIC(12,2),
  budget_max            NUMERIC(12,2),
  budget_tier           TEXT CHECK (budget_tier IN ('low', 'mid', 'high')),
  is_recurring_type_need BOOLEAN,
  buyer_location        TEXT,

  -- AI extraction
  pain_symptom          TEXT,
  pain_root_cause       TEXT,
  solution_specific     TEXT,
  solution_pattern      TEXT,
  saas_pitch            TEXT,

  -- Scoring signal fields (AI-extracted, deterministic scoring applied server-side)
  pain_clarity          TEXT CHECK (pain_clarity IN ('vague', 'clear', 'acute')),
  solution_saas_fit     TEXT CHECK (solution_saas_fit IN ('unlikely', 'possible', 'strong')),
  recurrence_potential  TEXT CHECK (recurrence_potential IN ('one_off', 'recurring', 'infrastructure')),

  -- Computed score (0.0–10.0)
  viability_score       NUMERIC(4,1),

  -- Status
  status                TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'saved', 'dismissed')),

  -- AI process tracking
  ai_processed_at       TIMESTAMPTZ,
  ai_error              TEXT,
  ai_raw_extraction     TEXT,
  ai_confidence         REAL
);
```

### `idea_tags` table

```sql
CREATE TABLE idea_tags (
  idea_id   INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  source    TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  PRIMARY KEY (idea_id, tag)
);
```

No clusters table. No buyers table. Trend signals are aggregate queries over `ideas`.

---

## Viability Score Formula

Score is computed deterministically in TypeScript from AI-extracted signal fields. Max = 10.

```typescript
function computeViabilityScore(idea: {
  budget_tier: string | null;
  pain_clarity: string | null;
  solution_saas_fit: string | null;
  recurrence_potential: string | null;
  tools_mentioned: string[] | null;
}): number {
  const budget     = { low: 1, mid: 2, high: 3 }[idea.budget_tier ?? ''] ?? 0;
  const pain       = { vague: 0, clear: 1, acute: 2 }[idea.pain_clarity ?? ''] ?? 0;
  const fit        = { unlikely: 0, possible: 1, strong: 2 }[idea.solution_saas_fit ?? ''] ?? 0;
  const recurrence = { one_off: 0, recurring: 1, infrastructure: 2 }[idea.recurrence_potential ?? ''] ?? 0;
  const tools      = Math.min((idea.tools_mentioned?.length ?? 0), 1); // 0 or 1

  return budget + pain + fit + recurrence + tools; // max 10
}
```

Null values contribute 0 (no signal, not a penalty). Formula is v1 — weights will be tuned as usage data accumulates.

---

## Auto-Tagging

After extraction and scoring, auto-tags are derived from structured fields:

```typescript
function deriveTags(idea): string[] {
  const tags: string[] = [];
  if (idea.vertical) tags.push(idea.vertical.toLowerCase());
  if (idea.solution_pattern) tags.push(idea.solution_pattern.toLowerCase());
  if (idea.recurrence_potential === 'infrastructure') tags.push('infrastructure');
  if (idea.recurrence_potential === 'recurring') tags.push('recurring-need');
  if (idea.solution_saas_fit === 'strong') tags.push('strong-fit');
  if (idea.budget_tier === 'high') tags.push('high-budget');
  if (idea.is_recurring_type_need) tags.push('recurring-type');
  (idea.tools_mentioned ?? []).slice(0, 3).forEach(t => tags.push(`tool:${t.toLowerCase()}`));
  return [...new Set(tags)];
}
```

Manual tags can be added by the user at any time via the UI.

---

## AI Extraction

Single Anthropic call (claude-haiku-4-5-20251001) during processing. Returns all fields in one JSON response:

```json
{
  "vertical": "...",
  "tools_mentioned": [],
  "budget_tier": "mid",
  "is_recurring_type_need": true,
  "pain_symptom": "...",
  "pain_root_cause": "...",
  "solution_specific": "...",
  "solution_pattern": "...",
  "saas_pitch": "...",
  "pain_clarity": "clear",
  "solution_saas_fit": "possible",
  "recurrence_potential": "recurring"
}
```

Processing is triggered manually via a "Process Inbox" button in the UI (same batch model as current app). Single-job analysis triggered from extension popup.

---

## App Screens

### Inbox (`/inbox`)
- Lists all ideas with `status = 'inbox'`, sorted by captured_at DESC
- Shows: title, captured_at, budget (if available), source badge
- Actions: Process (trigger AI batch), Save, Dismiss per-item
- "Process N unprocessed" button triggers batch AI extraction

### Ideas (`/` or `/ideas`)
- Lists all ideas with `status = 'saved'`, sorted by viability_score DESC
- Shows: title, viability score (colored 0-10 bar), top 3 tags, saas_pitch excerpt
- Filter by: tag, vertical, score range
- Click → Idea detail

### Idea Detail (`/ideas/[id]`)
- Full pain/solution fields
- Viability score breakdown (which components contributed)
- All tags (auto + manual, ability to add/remove)
- Saas pitch
- Link to original Upwork listing
- Save / Dismiss / Move to Inbox actions

### Trends (`/trends`)
- Phase 2. Aggregate view: top verticals by listing count, avg budget by vertical, recurring vs one-off breakdown, top tools.
- In Phase 1: stub page with "More data needed — capture more listings to unlock trends."

---

## Extension Integration

The existing Chrome extension is unchanged. It already:
- Captures batch listings from Upwork feed → POST `/api/listings`
- Analyzes single job page → POST `/api/analyze-single`

The new backend replaces the API endpoints but keeps the same contract. Extension users experience no change.

The `POST /api/listings` endpoint upserts to `ideas` table with `status = 'inbox'`, `ai_processed_at = null`. Batch AI processing runs on demand.

The `POST /api/analyze-single` endpoint extracts + scores immediately (no inbox step) and returns the result for display in the popup. The idea is saved with `status = 'saved'` by default (user explicitly chose to analyze it).

---

## API Surface

```
POST /api/listings           — bulk capture from extension, upsert to inbox
POST /api/analyze-single     — single-job extraction + immediate scoring
POST /api/ideas/process      — trigger batch AI on all inbox ideas
GET  /api/ideas              — list ideas (status filter, sort, pagination)
GET  /api/ideas/[id]         — single idea detail
PATCH /api/ideas/[id]        — update status or add manual tag
GET  /api/trends             — aggregate signals (Phase 2)
```

---

## Tech Stack

- **Framework**: Next.js 15 App Router
- **Database**: PostgreSQL via `pg` Pool, parameterized queries (same pattern as current app)
- **AI**: Anthropic SDK, claude-haiku-4-5-20251001
- **Styling**: Tailwind CSS
- **Extension**: Existing Chrome MV3 extension, no changes needed

---

## Project Structure

New app lives at `/Users/benjaminpoon/dev/pangolin-v2/` (separate from current app).

```
pangolin-v2/
  web/
    src/
      app/
        page.tsx                    — redirect to /ideas
        ideas/
          page.tsx                  — Ideas list
          [id]/page.tsx             — Idea detail
        inbox/page.tsx              — Inbox
        trends/page.tsx             — Trends (Phase 2 stub)
        api/
          listings/route.ts         — bulk capture
          analyze-single/route.ts   — single-job analyze
          ideas/
            route.ts                — GET list, POST process
            [id]/route.ts           — GET detail, PATCH update
          trends/route.ts           — aggregate signals
      lib/
        db.ts                       — pg Pool
        ai.ts                       — Anthropic extraction
        scoring.ts                  — computeViabilityScore()
        tagging.ts                  — deriveTags()
      types/index.ts                — shared types
    schema.sql
```

---

## Out of Scope (v1)

- Buyer enrichment
- Email/Slack notifications
- Cluster grouping
- User accounts / auth
- Mobile UI
