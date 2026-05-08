# Pain & Solution Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich per-listing AI extraction with four new fields (pain_symptom, pain_root_cause, solution_specific, solution_pattern) and surface them in the listing detail UI and product brief generation.

**Architecture:** Extend the existing `extractListingBatch` prompt with 4 new JSON fields, persist them to new `listings` columns, display them as a collapsible section in `ListingCard`, and feed them into `generateProductBrief` for richer SaaS idea synthesis. A backfill route handles already-processed listings.

**Tech Stack:** PostgreSQL (ALTER TABLE migration), TypeScript, Next.js 15 API routes, Anthropic SDK (claude-haiku-4-5-20251001), React 19

---

## File Map

| File | Action |
|---|---|
| `schema.sql` | Append migration SQL for reference |
| `web/src/lib/ai.ts` | Extend `ExtractionResult`, `WorkflowInput`, both extraction prompts, brief prompt block |
| `web/src/app/api/process/extract/route.ts` | Add 4 new fields to UPDATE query |
| `web/src/app/api/process/backfill-pain/route.ts` | Create new route |
| `web/src/app/components/types.ts` | Add 4 fields to `Listing` interface |
| `web/src/app/components/ListingCard.tsx` | Add Pain & Solution collapsible section |
| `web/src/app/api/clusters/[id]/brief/route.ts` | Pass new fields to `generateProductBrief` |
| `web/src/app/api/verticals/[name]/brief/route.ts` | Pass new fields to `generateProductBrief` |

---

### Task 1: DB Migration

**Files:**
- Modify: `schema.sql` (append comment block)
- Run: SQL directly against the database

- [ ] **Step 1: Run migration SQL**

```bash
psql "$DATABASE_URL" <<'SQL'
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS pain_symptom     TEXT,
  ADD COLUMN IF NOT EXISTS pain_root_cause  TEXT,
  ADD COLUMN IF NOT EXISTS solution_specific TEXT,
  ADD COLUMN IF NOT EXISTS solution_pattern  TEXT;

CREATE INDEX IF NOT EXISTS idx_listings_pain_backfill
  ON listings(id)
  WHERE pain_symptom IS NULL AND ai_processed_at IS NOT NULL;
SQL
```

Expected output: `ALTER TABLE` then `CREATE INDEX`

- [ ] **Step 2: Verify columns exist**

```bash
psql "$DATABASE_URL" -c "\d listings" | grep -E "pain|solution"
```

Expected: 4 rows showing `pain_symptom`, `pain_root_cause`, `solution_specific`, `solution_pattern` all as `text`

- [ ] **Step 3: Append migration to schema.sql for reference**

Append to the bottom of `schema.sql`:

```sql

-- Migration: pain & solution extraction fields (2026-05-08)
-- ALTER TABLE listings
--   ADD COLUMN IF NOT EXISTS pain_symptom     TEXT,
--   ADD COLUMN IF NOT EXISTS pain_root_cause  TEXT,
--   ADD COLUMN IF NOT EXISTS solution_specific TEXT,
--   ADD COLUMN IF NOT EXISTS solution_pattern  TEXT;
-- CREATE INDEX IF NOT EXISTS idx_listings_pain_backfill
--   ON listings(id) WHERE pain_symptom IS NULL AND ai_processed_at IS NOT NULL;
```

- [ ] **Step 4: Commit**

```bash
git add schema.sql
git commit -m "feat: add pain/solution columns to listings table"
```

---

### Task 2: Extend AI extraction types and prompts

**Files:**
- Modify: `web/src/lib/ai.ts`

- [ ] **Step 1: Add 4 fields to `ExtractionResult` interface**

In `web/src/lib/ai.ts`, find the `ExtractionResult` interface (line ~65) and extend it:

```typescript
export interface ExtractionResult {
  problem_category: string;
  vertical: string;
  workflow_described: string;
  tools_mentioned: string[];
  budget_tier: "low" | "mid" | "high";
  is_recurring_type_need: boolean;
  buyer_company_name: string | null;
  buyer_industry: string | null;
  confidence: number;
  pain_symptom: string | null;
  pain_root_cause: string | null;
  solution_specific: string | null;
  solution_pattern: string | null;
}
```

- [ ] **Step 2: Extend the `extractListing` prompt**

Find the `content` string in `extractListing` (the single-listing fallback). Replace the JSON schema comment block so it includes the 4 new fields after `"confidence"`:

```typescript
content: `Analyze this Upwork job listing and extract structured fields.

Title: ${title}
Description: ${description || "(not provided)"}
Skills: ${skills.length > 0 ? skills.join(", ") : "(none listed)"}
Budget: ${budgetMin != null ? `$${budgetMin}` : "?"}${budgetMax != null && budgetMax !== budgetMin ? ` - $${budgetMax}` : ""}

Return ONLY valid JSON with these fields:
{
  "problem_category": "specific problem being solved, at the level of 'could this be one product?' — e.g. 'DocuSign-to-Salesforce sync for real estate agents' not just 'CRM integration'",
  "vertical": "industry/vertical (e.g. Real Estate, E-commerce, Healthcare)",
  "workflow_described": "the manual workflow or pain point described, one sentence",
  "tools_mentioned": ["list", "of", "tools", "and", "platforms"],
  "budget_tier": "low (<$500) | mid ($500-$5000) | high (>$5000)",
  "is_recurring_type_need": true/false (is this a problem many businesses would have?),
  "buyer_company_name": "company name if detectable, else null",
  "buyer_industry": "buyer's industry if detectable, else null",
  "confidence": 0.0-1.0 (1.0 = clear listing with explicit details, 0.7 = reasonable but some inference needed, 0.5 = ambiguous with significant interpretation, 0.3 = vague listing where you are mostly guessing),
  "pain_symptom": "what the buyer explicitly describes struggling with — the surface complaint in one sentence, or null if unclear",
  "pain_root_cause": "the underlying systemic reason they have this problem — one sentence, or null if not inferable",
  "solution_specific": "exactly what they are asking to be built or done — one sentence, or null if vague",
  "solution_pattern": "the generalised product category this represents — e.g. 'QuickBooks to 3PL sync tool for e-commerce ops teams' not just 'integration', or null if unclear"
}`,
```

- [ ] **Step 3: Extend the `extractListingBatch` prompt**

Find the `content` string in `extractListingBatch` (the batch function). Replace the JSON schema block so it includes the 4 new fields:

```typescript
content: `Analyze these ${listings.length} Upwork job listings and extract structured fields for each.

${listingsBlock}

Return ONLY a valid JSON array. Each element must have an "id" field matching the Listing ID, plus these fields:
{
  "id": <listing id>,
  "problem_category": "specific problem being solved, at the level of 'could this be one product?' — e.g. 'DocuSign-to-Salesforce sync for real estate agents' not just 'CRM integration'",
  "vertical": "industry/vertical (e.g. Real Estate, E-commerce, Healthcare)",
  "workflow_described": "the manual workflow or pain point described, one sentence",
  "tools_mentioned": ["list", "of", "tools", "and", "platforms"],
  "budget_tier": "low (<$500) | mid ($500-$5000) | high (>$5000)",
  "is_recurring_type_need": true/false,
  "buyer_company_name": "company name if detectable, else null",
  "buyer_industry": "buyer's industry if detectable, else null",
  "confidence": 0.0-1.0 (1.0 = clear listing with explicit details, 0.7 = reasonable but some inference needed, 0.5 = ambiguous with significant interpretation, 0.3 = vague listing where you are mostly guessing),
  "pain_symptom": "what the buyer explicitly describes struggling with — surface complaint one sentence, or null if unclear",
  "pain_root_cause": "underlying systemic reason they have this problem — one sentence, or null if not inferable",
  "solution_specific": "exactly what they are asking to be built or done — one sentence, or null if vague",
  "solution_pattern": "generalised product category — e.g. 'QuickBooks to 3PL sync tool for e-commerce ops teams' not just 'integration', or null if unclear"
}`,
```

- [ ] **Step 4: Update the batch result mapping to read the 4 new fields**

In the `extractListingBatch` function, find where `ExtractionResult` is assembled from `item` (around line ~210). Extend it:

```typescript
const result: ExtractionResult = {
  problem_category: item.problem_category ?? "",
  vertical: item.vertical ?? "",
  workflow_described: item.workflow_described ?? "",
  tools_mentioned: Array.isArray(item.tools_mentioned) ? item.tools_mentioned : [],
  budget_tier: item.budget_tier ?? "mid",
  is_recurring_type_need: !!item.is_recurring_type_need,
  buyer_company_name: item.buyer_company_name ?? null,
  buyer_industry: item.buyer_industry ?? null,
  confidence: typeof item.confidence === "number" ? item.confidence : 0.5,
  pain_symptom: item.pain_symptom ?? null,
  pain_root_cause: item.pain_root_cause ?? null,
  solution_specific: item.solution_specific ?? null,
  solution_pattern: item.solution_pattern ?? null,
};
```

- [ ] **Step 5: Extend `WorkflowInput` interface**

Find `WorkflowInput` (around line ~339) and add the 4 new optional fields:

```typescript
export interface WorkflowInput {
  title: string;
  workflow_described: string | null;
  problem_category: string | null;
  tools_mentioned: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  is_recurring: boolean | null;
  pain_symptom?: string | null;
  pain_root_cause?: string | null;
  solution_specific?: string | null;
  solution_pattern?: string | null;
}
```

- [ ] **Step 6: Extend the `generateProductBrief` prompt block**

Find the `.map((w, i) => { ... })` block in `generateProductBrief` (around line ~362). Replace the template string body:

```typescript
return `--- #${i + 1} ---
Title: ${w.title}
Workflow: ${w.workflow_described || "(not described)"}
Problem: ${w.problem_category || "(unknown)"}
Tools: ${w.tools_mentioned?.join(", ") || "(none)"}
Budget: ${budget}
Recurring: ${w.is_recurring ? "yes" : "no"}${w.pain_symptom ? `\nPain symptom: ${w.pain_symptom}` : ""}${w.pain_root_cause ? `\nRoot cause: ${w.pain_root_cause}` : ""}${w.solution_specific ? `\nSolution ask: ${w.solution_specific}` : ""}${w.solution_pattern ? `\nProduct pattern: ${w.solution_pattern}` : ""}`;
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/ai.ts
git commit -m "feat: add pain/solution fields to extraction prompts and WorkflowInput"
```

---

### Task 3: Persist new fields in the extract route

**Files:**
- Modify: `web/src/app/api/process/extract/route.ts`

- [ ] **Step 1: Extend the UPDATE query**

Find the `await query(` call that updates listings on success (around line ~109). Replace the entire query call:

```typescript
await query(
  `UPDATE listings SET
    problem_category = $1, vertical = $2, workflow_described = $3,
    tools_mentioned = $4, budget_tier = $5, is_recurring_type_need = $6,
    ai_processed_at = now(), ai_error = NULL,
    ai_raw_extraction = $8, ai_confidence = $9,
    pain_symptom = $10, pain_root_cause = $11,
    solution_specific = $12, solution_pattern = $13
  WHERE id = $7`,
  [
    item.result.problem_category,
    item.result.vertical,
    item.result.workflow_described,
    item.result.tools_mentioned,
    budgetTier,
    item.result.is_recurring_type_need,
    item.id,
    JSON.stringify(item.result),
    item.result.confidence,
    item.result.pain_symptom ?? null,
    item.result.pain_root_cause ?? null,
    item.result.solution_specific ?? null,
    item.result.solution_pattern ?? null,
  ]
);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web/src/app/api/process/extract/route.ts
git commit -m "feat: persist pain/solution fields in extract route"
```

---

### Task 4: Create backfill route

**Files:**
- Create: `web/src/app/api/process/backfill-pain/route.ts`

- [ ] **Step 1: Create the backfill route**

Create `web/src/app/api/process/backfill-pain/route.ts`:

```typescript
import { query, queryOne } from "@/lib/db";
import { extractListingBatch, BATCH_SIZE, type BatchListingInput } from "@/lib/ai";
import { classifyApiError, computeCostCents, finalizeRun } from "../../shared";

export async function POST(req: Request) {
  let limit = 20;
  try {
    const body = await req.json();
    if (body.limit && Number.isInteger(body.limit) && body.limit > 0) {
      limit = Math.min(body.limit, 500);
    }
  } catch {}

  const listings = await query<{
    id: number;
    title: string;
    description: string | null;
    skills: string[];
    budget_min: number | null;
    budget_max: number | null;
  }>(
    `SELECT id, title, description, skills, budget_min, budget_max
     FROM listings
     WHERE pain_symptom IS NULL AND ai_processed_at IS NOT NULL
     ORDER BY captured_at DESC
     LIMIT $1`,
    [limit]
  );

  if (listings.length === 0) {
    return Response.json({ message: "No listings need backfill", processed: 0, succeeded: 0, failed: 0, cost_cents: 0 });
  }

  const total = listings.length;
  const run = await queryOne<{ id: number }>(
    `INSERT INTO processing_runs (listings_total, status) VALUES ($1, 'running') RETURNING id`,
    [total]
  );
  const runId = run!.id;

  let succeeded = 0;
  let failed = 0;
  let totalIn = 0;
  let totalOut = 0;

  const batches: BatchListingInput[][] = [];
  for (let i = 0; i < listings.length; i += BATCH_SIZE) {
    batches.push(
      listings.slice(i, i + BATCH_SIZE).map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        skills: l.skills,
        budgetMin: l.budget_min,
        budgetMax: l.budget_max,
      }))
    );
  }

  for (const batch of batches) {
    try {
      const { results, usage } = await extractListingBatch(batch);
      totalIn += usage.input_tokens;
      totalOut += usage.output_tokens;

      for (const item of results) {
        if (item.result) {
          await query(
            `UPDATE listings SET
              pain_symptom = $1, pain_root_cause = $2,
              solution_specific = $3, solution_pattern = $4
             WHERE id = $5`,
            [
              item.result.pain_symptom ?? null,
              item.result.pain_root_cause ?? null,
              item.result.solution_specific ?? null,
              item.result.solution_pattern ?? null,
              item.id,
            ]
          );
          succeeded++;
        } else {
          failed++;
        }
      }
    } catch (err: any) {
      const classified = classifyApiError(err);
      failed += batch.length;
      if (classified.fatal) {
        await finalizeRun(runId, "aborted", succeeded, failed, total, totalIn, totalOut, 0, 0, classified.message);
        return Response.json({ error: classified.message, processed: succeeded + failed, succeeded, failed, cost_cents: computeCostCents(totalIn, totalOut, 0, 0) }, { status: 500 });
      }
    }
  }

  const { costCents } = await finalizeRun(runId, "completed", succeeded, failed, total, totalIn, totalOut, 0, 0);

  return Response.json({ processed: total, succeeded, failed, cost_cents: costCents, run_id: runId });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Test the route**

```bash
curl -X POST http://localhost:3939/api/process/backfill-pain \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'
```

Expected: JSON response like `{"processed":5,"succeeded":5,"failed":0,"cost_cents":1,"run_id":N}` or `{"message":"No listings need backfill",...}`

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/process/backfill-pain/route.ts
git commit -m "feat: add backfill-pain route to populate pain/solution fields on existing listings"
```

---

### Task 5: Update Listing types

There are two `Listing` interfaces: `web/src/types/index.ts` (used by API routes) and `web/src/app/components/types.ts` (used by UI components). Both need the 4 new fields.

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/app/components/types.ts`

- [ ] **Step 1: Add 4 fields to `web/src/types/index.ts`**

Find the `Listing` interface and add the 4 new fields after `buyer_id`:

```typescript
export interface Listing {
  id: number;
  upwork_url: string | null;
  title: string;
  description: string | null;
  budget_type: "fixed" | "hourly" | null;
  budget_min: number | null;
  budget_max: number | null;
  skills: string[];
  category: string | null;
  posted_at: string | null;
  captured_at: string;
  raw_data: Record<string, any> | null;
  problem_category: string | null;
  vertical: string | null;
  workflow_described: string | null;
  tools_mentioned: string[] | null;
  budget_tier: "low" | "mid" | "high" | null;
  is_recurring_type_need: boolean | null;
  ai_processed_at: string | null;
  buyer_id: number | null;
  pain_symptom: string | null;
  pain_root_cause: string | null;
  solution_specific: string | null;
  solution_pattern: string | null;
}
```

- [ ] **Step 2: Add 4 fields to `web/src/app/components/types.ts`**

Find the `Listing` interface and add the 4 new fields after `ai_raw_extraction`:

```typescript
export interface Listing {
  id: number;
  title: string;
  description: string | null;
  upwork_url: string | null;
  budget_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  problem_category: string | null;
  vertical: string | null;
  tools_mentioned: string[] | null;
  skills: string[] | null;
  captured_at: string;
  proposal_tier: string | null;
  job_tier: string | null;
  engagement_duration: string | null;
  connect_price: number | null;
  payment_verified: boolean | null;
  is_enterprise: boolean | null;
  is_premium: boolean | null;
  category: string | null;
  posted_at: string | null;
  workflow_described: string | null;
  is_recurring_type_need: boolean | null;
  ai_confidence: number | null;
  ai_raw_extraction: string | null;
  pain_symptom: string | null;
  pain_root_cause: string | null;
  solution_specific: string | null;
  solution_pattern: string | null;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add web/src/types/index.ts web/src/app/components/types.ts
git commit -m "feat: add pain/solution fields to Listing types"
```

---

### Task 6: Add Pain & Solution section to ListingCard

**Files:**
- Modify: `web/src/app/components/ListingCard.tsx`

- [ ] **Step 1: Add `painExpanded` state**

After the existing state declarations at the top of `ListingCard`, add:

```typescript
const [painExpanded, setPainExpanded] = useState(false);
```

- [ ] **Step 2: Add the Pain & Solution toggle button**

In the metadata row `<div>` (the one containing "Spot-check", feedback buttons, etc.), add the toggle button after the "Spot-check" button. Only render if at least one pain/solution field is non-null:

```tsx
{(l.pain_symptom || l.pain_root_cause || l.solution_specific || l.solution_pattern) && (
  <button
    onClick={() => setPainExpanded(!painExpanded)}
    style={{
      background: painExpanded ? "#f0fdf4" : "#f3f4f6",
      color: painExpanded ? "#059669" : "#374151",
      border: "none",
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 8px",
    }}
  >
    {painExpanded ? "▾ Pain & Solution" : "▸ Pain & Solution"}
  </button>
)}
```

- [ ] **Step 3: Add the Pain & Solution panel**

After the reassign panel block (the `{showReassign && ...}` block) and before the spot-check panel block, add:

```tsx
{/* Pain & Solution panel */}
{painExpanded && (
  <div
    style={{
      marginTop: 8,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
      padding: 12,
      background: "#f0fdf4",
      borderRadius: 6,
      border: "1px solid #bbf7d0",
      fontSize: 12,
    }}
  >
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {l.pain_symptom && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
            Symptom
          </div>
          <div style={{ color: "#374151" }}>{l.pain_symptom}</div>
        </div>
      )}
      {l.pain_root_cause && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
            Root cause
          </div>
          <div style={{ color: "#374151" }}>{l.pain_root_cause}</div>
        </div>
      )}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {l.solution_specific && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
            Specific ask
          </div>
          <div style={{ color: "#374151" }}>{l.solution_specific}</div>
        </div>
      )}
      {l.solution_pattern && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
            Product pattern
          </div>
          <div style={{ color: "#059669", fontWeight: 600 }}>{l.solution_pattern}</div>
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add web/src/app/components/ListingCard.tsx
git commit -m "feat: add Pain & Solution collapsible section to ListingCard"
```

---

### Task 7: Pass new fields through brief routes

**Files:**
- Modify: `web/src/app/api/clusters/[id]/brief/route.ts`
- Modify: `web/src/app/api/verticals/[name]/brief/route.ts`

- [ ] **Step 1: Update cluster brief SQL query**

In `web/src/app/api/clusters/[id]/brief/route.ts`, extend the `workflows` query type and SQL to include the 4 new fields:

```typescript
const workflows = await query<{
  title: string;
  workflow_described: string | null;
  problem_category: string | null;
  tools_mentioned: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  is_recurring_type_need: boolean | null;
  pain_symptom: string | null;
  pain_root_cause: string | null;
  solution_specific: string | null;
  solution_pattern: string | null;
}>(
  `SELECT l.title, l.workflow_described, l.problem_category, l.tools_mentioned,
          l.budget_min, l.budget_max, l.is_recurring_type_need,
          l.pain_symptom, l.pain_root_cause, l.solution_specific, l.solution_pattern
   FROM listings l
   JOIN listing_clusters lc ON lc.listing_id = l.id
   WHERE lc.cluster_id = $1
   ORDER BY l.captured_at DESC`,
  [clusterId]
);
```

- [ ] **Step 2: Pass new fields to `generateProductBrief` in cluster brief**

Update the `.map()` call in the cluster brief route:

```typescript
const { result: brief, usage } = await generateProductBrief(
  workflows.map((w) => ({
    title: w.title,
    workflow_described: w.workflow_described,
    problem_category: w.problem_category,
    tools_mentioned: w.tools_mentioned,
    budget_min: w.budget_min,
    budget_max: w.budget_max,
    is_recurring: w.is_recurring_type_need,
    pain_symptom: w.pain_symptom,
    pain_root_cause: w.pain_root_cause,
    solution_specific: w.solution_specific,
    solution_pattern: w.solution_pattern,
  })),
  {
    source_name: cluster.name,
    source_type: "cluster",
    listing_count: cluster.listing_count,
    avg_budget: cluster.avg_budget != null ? Number(cluster.avg_budget) : null,
  }
);
```

- [ ] **Step 3: Update vertical brief SQL query**

In `web/src/app/api/verticals/[name]/brief/route.ts`, extend the `workflows` query type and SQL:

```typescript
const workflows = await query<{
  title: string;
  workflow_described: string | null;
  problem_category: string | null;
  tools_mentioned: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  is_recurring_type_need: boolean | null;
  pain_symptom: string | null;
  pain_root_cause: string | null;
  solution_specific: string | null;
  solution_pattern: string | null;
}>(
  `SELECT l.title, l.workflow_described, l.problem_category, l.tools_mentioned,
          l.budget_min, l.budget_max, l.is_recurring_type_need,
          l.pain_symptom, l.pain_root_cause, l.solution_specific, l.solution_pattern
   FROM listings l
   WHERE l.vertical = $1 AND l.ai_processed_at IS NOT NULL
   ORDER BY l.captured_at DESC
   LIMIT 50`,
  [vertical]
);
```

- [ ] **Step 4: Pass new fields to `generateProductBrief` in vertical brief**

```typescript
const { result: brief, usage } = await generateProductBrief(
  workflows.map((w) => ({
    title: w.title,
    workflow_described: w.workflow_described,
    problem_category: w.problem_category,
    tools_mentioned: w.tools_mentioned,
    budget_min: w.budget_min,
    budget_max: w.budget_max,
    is_recurring: w.is_recurring_type_need,
    pain_symptom: w.pain_symptom,
    pain_root_cause: w.pain_root_cause,
    solution_specific: w.solution_specific,
    solution_pattern: w.solution_pattern,
  })),
  {
    source_name: vertical,
    source_type: "vertical",
    listing_count: Number(summary.listing_count),
    avg_budget: summary.avg_budget != null ? Number(summary.avg_budget) : null,
  }
);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add web/src/app/api/clusters/[id]/brief/route.ts web/src/app/api/verticals/[name]/brief/route.ts
git commit -m "feat: pass pain/solution fields to generateProductBrief"
```

---

### Task 8: End-to-end smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd web && npm run dev
```

Wait for `Ready on http://localhost:3939`

- [ ] **Step 2: Process a small batch to get new fields populated**

```bash
curl -X POST http://localhost:3939/api/process/extract \
  -H "Content-Type: application/json" \
  -d '{"limit": 3}'
```

Or if no unprocessed listings exist, run the backfill:

```bash
curl -X POST http://localhost:3939/api/process/backfill-pain \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'
```

- [ ] **Step 3: Verify new fields in DB**

```bash
psql "$DATABASE_URL" -c "SELECT id, pain_symptom, solution_pattern FROM listings WHERE pain_symptom IS NOT NULL LIMIT 3;"
```

Expected: 3 rows with non-null `pain_symptom` and `solution_pattern`

- [ ] **Step 4: Open the dashboard and verify UI**

Navigate to `http://localhost:3939`, open a cluster detail, find a listing with pain/solution data, click "▸ Pain & Solution" and confirm the 4 fields appear in the green panel.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: pain & solution extraction — enrich listings with symptom, root cause, specific ask, product pattern"
```
