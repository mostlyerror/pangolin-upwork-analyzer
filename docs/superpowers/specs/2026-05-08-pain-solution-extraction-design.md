# Pain & Solution Extraction — Design Spec
Date: 2026-05-08

## Goal
Enrich per-listing AI extraction with four new fields that explicitly capture the buyer's pain point (symptom and root cause) and the solution they're seeking (specific ask and generalised product pattern). These fields surface in the listing detail UI and feed into product brief generation to improve SaaS/product idea synthesis.

## Data Model

Four new nullable columns added to the `listings` table via migration:

| Column | Type | Description |
|---|---|---|
| `pain_symptom` | `TEXT` | What the buyer explicitly describes struggling with — the surface complaint |
| `pain_root_cause` | `TEXT` | The underlying systemic reason they have this problem |
| `solution_specific` | `TEXT` | Exactly what they're asking to be built or done, one sentence |
| `solution_pattern` | `TEXT` | Generalised product category (e.g. "QuickBooks ↔ 3PL sync tool for e-commerce ops teams") |

All four are `NULL` until processed, matching the pattern of existing AI fields (`problem_category`, `vertical`, etc.). A partial index `WHERE pain_symptom IS NULL` supports backfill queries.

## AI Extraction Changes

### Prompt
`extractListingBatch` (and the single-listing `extractListing` fallback) gains four new fields in its JSON output schema:

```json
"pain_symptom": "what the buyer explicitly describes struggling with — surface complaint, one sentence",
"pain_root_cause": "the underlying systemic reason — why do they have this problem at all?",
"solution_specific": "exactly what they're asking to be built or done, one sentence",
"solution_pattern": "generalised product category — e.g. 'QuickBooks ↔ 3PL sync tool for e-commerce ops teams', not just 'integration'"
```

### TypeScript Interface
`ExtractionResult` in `web/src/lib/ai.ts` gains:
```ts
pain_symptom: string | null;
pain_root_cause: string | null;
solution_specific: string | null;
solution_pattern: string | null;
```

### DB Write
`/api/process/extract/route.ts` extended to persist all four fields alongside existing extraction columns.

## Backfill Route

**`POST /api/process/backfill-pain`**

- Queries `listings WHERE pain_symptom IS NULL AND ai_processed_at IS NOT NULL`
- Re-runs `extractListingBatch` in batches (same configurable batch size)
- Writes results back to the four new columns
- Records token usage in `processing_runs`
- Returns `{ processed, succeeded, failed, cost_cents }`

## UI Changes

### ListingCard.tsx
Each listing card gains a collapsible "Pain & Solution" section (collapsed by default):

```
▸ Pain & Solution
  Symptom          | Specific ask
  Root cause       | Product pattern
```

Fields that are `NULL` are omitted. The toggle label shows "▸ Pain & Solution" / "▾ Pain & Solution".

### generateProductBrief (ai.ts)
`WorkflowInput` interface gains the four new fields (all optional/null). The per-listing block in the prompt is extended:

```
Pain: <pain_symptom> / Root: <pain_root_cause>
Solution ask: <solution_specific>
Pattern: <solution_pattern>
```

Fields are omitted from the block if null. No changes to the route handlers — `/api/clusters/[id]/brief` and `/api/verticals/[name]/brief` already pass workflow data through.

## Out of Scope
- Re-running clustering after backfill (clusters are not affected by these new fields)
- Displaying pain/solution in the cluster list sidebar rows
- Filtering/sorting clusters by solution_pattern

## Migration
```sql
ALTER TABLE listings
  ADD COLUMN pain_symptom    TEXT,
  ADD COLUMN pain_root_cause TEXT,
  ADD COLUMN solution_specific TEXT,
  ADD COLUMN solution_pattern  TEXT;

CREATE INDEX idx_listings_pain_backfill
  ON listings(id)
  WHERE pain_symptom IS NULL AND ai_processed_at IS NOT NULL;
```
