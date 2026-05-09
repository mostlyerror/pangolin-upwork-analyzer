# Single-Job Pain Point Analyzer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When on an Upwork job page, the Pangolin extension popup shows an "Analyze this job" button that calls Claude, stores the result in `listings`, and displays a pain + SaaS card.

**Architecture:** Extension detects job-page URL → content script extracts job data from the page → popup POSTs to a new `/api/analyze-single` endpoint → backend calls `extractListing()` (extended with `saas_pitch`) → upserts into `listings` table → returns card data to popup.

**Tech Stack:** Next.js 15 App Router, PostgreSQL (`pg` Pool), Anthropic SDK (claude-haiku-4-5-20251001), Chrome Extension MV3.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `web/src/types/index.ts` | Modify | Add `source` + `saas_pitch` to `Listing` interface |
| `web/src/app/components/types.ts` | Modify | Same additions to UI Listing interface |
| `web/src/lib/ai.ts` | Modify | Add `saas_pitch` to `ExtractionResult`, extend `extractListing` prompt |
| `web/src/app/api/analyze-single/route.ts` | Create | New POST endpoint: check cache → call Claude → upsert → return card |
| `extension/manifest.json` | Modify | Add `/jobs/*` to content script matches |
| `extension/content.js` | Modify | Add `extractSingleJob()` + `analyze` message handler |
| `extension/popup.html` | Modify | Add analyze section, card markup, card CSS |
| `extension/popup.js` | Modify | Add URL detection on load, analyze button handler |

---

## Task 1: DB Migration + Type Interfaces

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/app/components/types.ts`

- [ ] **Step 1: Run the migration**

```bash
psql postgresql://localhost:5432/pangolin -c "
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS source     TEXT NOT NULL DEFAULT 'batch',
  ADD COLUMN IF NOT EXISTS saas_pitch TEXT;
"
```

Expected output: `ALTER TABLE`

- [ ] **Step 2: Verify columns exist**

```bash
psql postgresql://localhost:5432/pangolin -c "\d listings" | grep -E "source|saas_pitch"
```

Expected: two rows showing `source` (text, not null, default 'batch') and `saas_pitch` (text).

- [ ] **Step 3: Update `web/src/types/index.ts`**

Add two fields after `solution_pattern` in the `Listing` interface:

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
  source: string;
  saas_pitch: string | null;
}
```

- [ ] **Step 4: Update `web/src/app/components/types.ts`**

Add the same two fields after `solution_pattern` in the `Listing` interface in that file:

```typescript
  solution_pattern: string | null;
  source: string;
  saas_pitch: string | null;
```

- [ ] **Step 5: TypeScript check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/types/index.ts web/src/app/components/types.ts
git commit -m "feat: add source and saas_pitch columns to listings schema and interfaces"
```

---

## Task 2: Add `saas_pitch` to AI Extraction

**Files:**
- Modify: `web/src/lib/ai.ts`

- [ ] **Step 1: Add `saas_pitch` to `ExtractionResult` interface**

In `web/src/lib/ai.ts`, add one field to the `ExtractionResult` interface after `solution_pattern`:

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
  saas_pitch: string | null;
}
```

- [ ] **Step 2: Extend `extractListing` prompt**

In the `extractListing` function, extend the JSON schema description in the prompt. Replace the closing `}` of the return ONLY valid JSON block with:

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
  "solution_pattern": "the generalised product category this represents — e.g. 'QuickBooks to 3PL sync tool for e-commerce ops teams' not just 'integration', or null if unclear",
  "saas_pitch": "3-5 sentence paragraph: what SaaS product could someone build to solve this pain at scale? Name the product category, the target customer, the core workflow it automates, and why it is a repeatable business."
}`,
```

- [ ] **Step 3: Map `saas_pitch` in the return value**

In `extractListing`, after the existing field mappings, add `saas_pitch`:

```typescript
  const result: ExtractionResult = {
    ...parsed,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    saas_pitch: typeof parsed.saas_pitch === "string" ? parsed.saas_pitch : null,
  };
```

- [ ] **Step 4: TypeScript check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/ai.ts
git commit -m "feat: add saas_pitch field to extractListing AI prompt and ExtractionResult"
```

---

## Task 3: POST /api/analyze-single Route

**Files:**
- Create: `web/src/app/api/analyze-single/route.ts`

- [ ] **Step 1: Verify the route doesn't exist yet (the "failing test")**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3939/api/analyze-single \
  -H "Content-Type: application/json" \
  -d '{"title":"test"}'
```

Expected: `404` (route doesn't exist).

- [ ] **Step 2: Create the route file**

Create `web/src/app/api/analyze-single/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { extractListing } from "@/lib/ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, skills, budgetMin, budgetMax, budgetType, url } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Return cached result if this URL was already analyzed
    if (url) {
      const cached = await queryOne<{
        id: number;
        pain_symptom: string | null;
        pain_root_cause: string | null;
        solution_pattern: string | null;
        saas_pitch: string | null;
      }>(
        `SELECT id, pain_symptom, pain_root_cause, solution_pattern, saas_pitch
         FROM listings WHERE upwork_url = $1 LIMIT 1`,
        [url]
      );
      if (cached && cached.pain_symptom != null && cached.saas_pitch != null) {
        return NextResponse.json(
          {
            listing_id: cached.id,
            pain_symptom: cached.pain_symptom,
            pain_root_cause: cached.pain_root_cause,
            solution_pattern: cached.solution_pattern,
            saas_pitch: cached.saas_pitch,
            cached: true,
          },
          { headers: corsHeaders }
        );
      }
    }

    // Run AI extraction
    const { result } = await extractListing(
      title,
      description ?? null,
      Array.isArray(skills) ? skills : [],
      typeof budgetMin === "number" ? budgetMin : null,
      typeof budgetMax === "number" ? budgetMax : null
    );

    const tierRaw = (result.budget_tier || "").toLowerCase();
    const budgetTier = tierRaw.includes("low")
      ? "low"
      : tierRaw.includes("high")
      ? "high"
      : "mid";

    // Upsert: insert fresh listing or overwrite AI fields on existing one
    const row = await queryOne<{ id: number }>(
      `INSERT INTO listings (
         upwork_url, title, description, budget_type, budget_min, budget_max, skills,
         source, problem_category, vertical, workflow_described, tools_mentioned,
         budget_tier, is_recurring_type_need, ai_confidence, ai_raw_extraction,
         pain_symptom, pain_root_cause, solution_specific, solution_pattern,
         saas_pitch, ai_processed_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         'single', $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19,
         $20, now()
       )
       ON CONFLICT (upwork_url) DO UPDATE SET
         source         = 'single',
         problem_category     = EXCLUDED.problem_category,
         vertical             = EXCLUDED.vertical,
         workflow_described   = EXCLUDED.workflow_described,
         tools_mentioned      = EXCLUDED.tools_mentioned,
         budget_tier          = EXCLUDED.budget_tier,
         is_recurring_type_need = EXCLUDED.is_recurring_type_need,
         ai_confidence        = EXCLUDED.ai_confidence,
         ai_raw_extraction    = EXCLUDED.ai_raw_extraction,
         pain_symptom         = EXCLUDED.pain_symptom,
         pain_root_cause      = EXCLUDED.pain_root_cause,
         solution_specific    = EXCLUDED.solution_specific,
         solution_pattern     = EXCLUDED.solution_pattern,
         saas_pitch           = EXCLUDED.saas_pitch,
         ai_processed_at      = now()
       RETURNING id`,
      [
        url ?? null,
        title,
        description ?? null,
        budgetType ?? null,
        typeof budgetMin === "number" ? budgetMin : null,
        typeof budgetMax === "number" ? budgetMax : null,
        Array.isArray(skills) ? skills : [],
        result.problem_category,
        result.vertical,
        result.workflow_described,
        result.tools_mentioned,
        budgetTier,
        result.is_recurring_type_need,
        result.confidence,
        JSON.stringify(result),
        result.pain_symptom ?? null,
        result.pain_root_cause ?? null,
        result.solution_specific ?? null,
        result.solution_pattern ?? null,
        result.saas_pitch ?? null,
      ]
    );

    return NextResponse.json(
      {
        listing_id: row?.id,
        pain_symptom: result.pain_symptom,
        pain_root_cause: result.pain_root_cause,
        solution_pattern: result.solution_pattern,
        saas_pitch: result.saas_pitch,
        cached: false,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
```

- [ ] **Step 3: Test with curl (route must return 201)**

With the Next.js dev server running (`cd web && npm run dev` on port 3939), send a realistic test payload:

```bash
curl -s -X POST http://localhost:3939/api/analyze-single \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Build a QuickBooks to Shopify inventory sync tool",
    "description": "We manage 3 Shopify stores and QuickBooks Desktop. Every night we manually export inventory from QB and re-import into Shopify. This takes 2 hours and causes overselling when we forget. Need an automated sync that runs on a schedule.",
    "skills": ["QuickBooks", "Shopify API", "Node.js"],
    "budgetMin": 1500,
    "budgetMax": 3000,
    "budgetType": "fixed",
    "url": "https://www.upwork.com/jobs/~test123"
  }' | python3 -m json.tool
```

Expected: HTTP 201 with JSON containing non-null `pain_symptom`, `pain_root_cause`, `solution_pattern`, and `saas_pitch` fields. Example shape:
```json
{
  "listing_id": 42,
  "pain_symptom": "Manual nightly inventory export from QuickBooks to Shopify takes 2 hours...",
  "pain_root_cause": "No native sync between QuickBooks Desktop and Shopify...",
  "solution_pattern": "QuickBooks Desktop ↔ Shopify inventory sync for multi-store e-commerce ops",
  "saas_pitch": "A scheduled sync tool that...",
  "cached": false
}
```

- [ ] **Step 4: Test cache hit (re-run same URL)**

Run the same curl command again. Should return `"cached": true` with the same data, without calling Claude again.

- [ ] **Step 5: TypeScript check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/api/analyze-single/route.ts
git commit -m "feat: add POST /api/analyze-single endpoint for single-job pain extraction"
```

---

## Task 4: Extension — Manifest + Content Script

**Files:**
- Modify: `extension/manifest.json`
- Modify: `extension/content.js`

- [ ] **Step 1: Add job page URL pattern to manifest**

In `extension/manifest.json`, add `"https://www.upwork.com/jobs/*"` to the `content_scripts[0].matches` array:

```json
{
  "manifest_version": 3,
  "name": "Pangolin — Upwork Signal Capture",
  "version": "0.1.0",
  "description": "Captures Upwork job listings for pattern analysis",
  "permissions": ["activeTab", "storage"],
  "host_permissions": ["https://www.upwork.com/*", "http://localhost/*"],
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.upwork.com/nx/*",
        "https://www.upwork.com/freelance-jobs/*",
        "https://www.upwork.com/jobs/*"
      ],
      "js": ["content.js"]
    }
  ]
}
```

- [ ] **Step 2: Add `extractSingleJob` function to `extension/content.js`**

Add this function before the `chrome.runtime.onMessage.addListener` call at the bottom of the file:

```javascript
// Extract data from a single job page (/jobs/~CIPHERTEXT)
function extractSingleJob() {
  // Try __NEXT_DATA__ first — Next.js embeds full page props as JSON
  try {
    const raw = document.getElementById('__NEXT_DATA__')?.textContent;
    if (raw) {
      const nextData = JSON.parse(raw);
      const p = nextData?.props?.pageProps;
      // Upwork stores job data under various keys depending on page variant
      const job = p?.jobDetails?.job || p?.opening || p?.job || null;
      if (job?.title) {
        const isHourly = job.hourlyBudget != null;
        return {
          title: job.title,
          description: job.description || job.descriptionText || null,
          skills: (job.skills || job.attrs || [])
            .map(s => s.prefLabel || s.name || (typeof s === 'string' ? s : null))
            .filter(Boolean),
          budgetMin: isHourly ? job.hourlyBudget?.min : (job.amount?.amount ?? null),
          budgetMax: isHourly ? job.hourlyBudget?.max : (job.amount?.amount ?? null),
          budgetType: isHourly ? 'hourly' : 'fixed',
          url: window.location.href,
        };
      }
    }
  } catch {}

  // DOM fallback — scrape visible elements
  const title = document.querySelector('h1')?.textContent?.trim();
  if (!title) return null;

  const descEl = document.querySelector(
    '[data-test="description"], .description-text, .up-c-line-clamp, .description'
  );
  const description = descEl?.textContent?.trim() || null;

  const skillEls = document.querySelectorAll(
    '[data-test="token"] span, .up-skill-badge span, .air3-badge-tagline'
  );
  const skills = [...skillEls].map(el => el.textContent?.trim()).filter(Boolean);

  return {
    title,
    description,
    skills,
    budgetMin: null,
    budgetMax: null,
    budgetType: 'fixed',
    url: window.location.href,
  };
}
```

- [ ] **Step 3: Add `analyze` message handler**

In the existing `chrome.runtime.onMessage.addListener` callback, add an `analyze` branch alongside the existing `extract` branch:

```javascript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'extract') {
    // existing code unchanged ...
    fetchListingsFromAPI(msg.limit || 50)
      .then(listings => {
        if (listings.length > 0) {
          sendResponse({ listings, count: listings.length, source: 'api' });
        } else {
          const domListings = extractListingsFromDOM();
          sendResponse({ listings: domListings, count: domListings.length, source: 'dom' });
        }
      })
      .catch(err => {
        const domListings = extractListingsFromDOM();
        sendResponse({
          listings: domListings,
          count: domListings.length,
          source: 'dom',
          apiError: err.message,
        });
      });
    return true;
  }

  if (msg.action === 'analyze') {
    const job = extractSingleJob();
    sendResponse(job ? { job } : { error: 'Could not extract job data from this page' });
    return true;
  }
});
```

- [ ] **Step 4: Reload the extension and manually verify content script injection**

1. Open Chrome → `chrome://extensions`
2. Find "Pangolin — Upwork Signal Capture" → click the reload (↺) button
3. Navigate to any Upwork single job page: `https://www.upwork.com/jobs/~01...`
4. Open DevTools Console on that page
5. Run: `chrome.runtime.sendMessage({action: 'analyze'})` — this won't work from the page console; instead open the extension popup DevTools (right-click popup → Inspect) and check that the page is in the matches list

   Alternatively: in the extension popup DevTools console, verify the tab URL matches `/jobs/~` by checking what the popup's `chrome.tabs.query` returns.

- [ ] **Step 5: Commit**

```bash
git add extension/manifest.json extension/content.js
git commit -m "feat: add extractSingleJob to content script and register job page URL pattern"
```

---

## Task 5: Extension Popup — Analyze Mode + Card UI

**Files:**
- Modify: `extension/popup.html`
- Modify: `extension/popup.js`

- [ ] **Step 1: Update `extension/popup.html`**

Replace the entire file with:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      width: 320px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      color: #1a1a1a;
    }
    h1 {
      font-size: 18px;
      margin: 0 0 4px;
    }
    .subtitle {
      color: #666;
      font-size: 12px;
      margin-bottom: 16px;
    }
    .config {
      margin-bottom: 12px;
    }
    .config label {
      font-size: 12px;
      color: #444;
      display: block;
      margin-bottom: 4px;
    }
    .config input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 12px;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 8px;
    }
    #captureBtn {
      background: #2563eb;
      color: white;
    }
    #captureBtn:hover { background: #1d4ed8; }
    #captureBtn:disabled {
      background: #93c5fd;
      cursor: not-allowed;
    }
    #copyBtn {
      background: #f3f4f6;
      color: #374151;
    }
    #copyBtn:hover { background: #e5e7eb; }
    #analyzeBtn {
      background: #059669;
      color: white;
    }
    #analyzeBtn:hover { background: #047857; }
    #analyzeBtn:disabled {
      background: #6ee7b7;
      cursor: not-allowed;
    }
    #status {
      margin-top: 8px;
      font-size: 12px;
      color: #666;
      min-height: 18px;
    }
    .count { font-weight: 600; color: #2563eb; }
    .card {
      margin-top: 12px;
      border: 1px solid #d1fae5;
      border-radius: 8px;
      padding: 12px;
      background: #f0fdf4;
      display: none;
    }
    .card.visible { display: block; }
    .card-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #059669;
      margin-top: 10px;
      margin-bottom: 2px;
    }
    .card-label:first-child { margin-top: 0; }
    .card-value {
      font-size: 12px;
      color: #1a1a1a;
      line-height: 1.4;
    }
    .card-saas {
      font-size: 13px;
      font-weight: 700;
      color: #047857;
    }
    .card-pitch {
      font-size: 11px;
      color: #374151;
      line-height: 1.5;
      margin-top: 6px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>Pangolin</h1>

  <div class="config">
    <label for="apiUrl">API URL</label>
    <input id="apiUrl" type="text" placeholder="http://localhost:3939/api/listings" />
  </div>

  <div id="batchSection">
    <p class="subtitle">Capture Upwork listings from this page</p>
    <button id="captureBtn">Capture &amp; Send</button>
    <button id="copyBtn">Copy JSON to Clipboard</button>
  </div>

  <div id="analyzeSection" style="display:none">
    <p class="subtitle">Analyze this job for pain &amp; SaaS signals</p>
    <button id="analyzeBtn">Analyze this job</button>
  </div>

  <div id="status"></div>

  <div id="analysisCard" class="card">
    <div class="card-label">Pain</div>
    <div id="cardPain" class="card-value"></div>
    <div class="card-label">Root cause</div>
    <div id="cardRoot" class="card-value"></div>
    <div class="card-label">SaaS idea</div>
    <div id="cardPattern" class="card-value card-saas"></div>
    <div id="cardPitch" class="card-pitch"></div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Update `extension/popup.js`**

Replace the entire file with:

```javascript
const DEFAULT_API_URL = 'http://localhost:3939/api/listings';

const apiUrlInput = document.getElementById('apiUrl');
const captureBtn = document.getElementById('captureBtn');
const copyBtn = document.getElementById('copyBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusEl = document.getElementById('status');
const analysisCard = document.getElementById('analysisCard');

// Load saved API URL
chrome.storage?.local?.get(['apiUrl'], (result) => {
  apiUrlInput.value = result.apiUrl || DEFAULT_API_URL;
});

apiUrlInput.addEventListener('change', () => {
  chrome.storage?.local?.set({ apiUrl: apiUrlInput.value });
});

function setStatus(msg) {
  statusEl.innerHTML = msg;
}

// On load: show analyze section on job pages, batch section everywhere else
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isJobPage = /upwork\.com\/jobs\/~/.test(tab.url || '');
  document.getElementById('batchSection').style.display = isJobPage ? 'none' : 'block';
  document.getElementById('analyzeSection').style.display = isJobPage ? 'block' : 'none';
})();

// Extract listings from the active tab's content script (batch mode)
async function extractFromPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { action: 'extract' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error('Not on an Upwork page, or page not fully loaded. Navigate to Upwork job search first.'));
        return;
      }
      resolve(response);
    });
  });
}

// Capture & Send to API (batch mode)
captureBtn.addEventListener('click', async () => {
  captureBtn.disabled = true;
  setStatus('Fetching listings from Upwork...');

  try {
    const { listings, count, source, apiError } = await extractFromPage();

    if (count === 0) {
      setStatus('No listings found.' + (apiError ? ` (API error: ${apiError})` : ''));
      captureBtn.disabled = false;
      return;
    }

    const sourceLabel = source === 'api' ? 'via API' : 'via DOM';
    setStatus(`Found <span class="count">${count}</span> listings ${sourceLabel}. Sending...`);

    const apiUrl = apiUrlInput.value || DEFAULT_API_URL;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listings),
    });

    if (!res.ok) throw new Error(`API returned ${res.status}`);

    const result = await res.json();
    setStatus(
      `Sent <span class="count">${result.inserted}</span> new, ${result.skipped} duplicates skipped. (${sourceLabel})`
    );
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }

  captureBtn.disabled = false;
});

// Copy JSON fallback (batch mode)
copyBtn.addEventListener('click', async () => {
  setStatus('Fetching listings from Upwork...');

  try {
    const { listings, count, source } = await extractFromPage();

    if (count === 0) {
      setStatus('No listings found.');
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(listings, null, 2));
    const sourceLabel = source === 'api' ? 'via API' : 'via DOM';
    setStatus(`Copied <span class="count">${count}</span> listings to clipboard. (${sourceLabel})`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

// Analyze single job (job page mode)
analyzeBtn.addEventListener('click', async () => {
  analyzeBtn.disabled = true;
  analysisCard.classList.remove('visible');
  setStatus('Extracting job from page...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const jobData = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: 'analyze' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Could not connect to page. Try reloading the Upwork tab first.'));
          return;
        }
        if (response?.error) reject(new Error(response.error));
        else resolve(response?.job);
      });
    });

    if (!jobData) {
      setStatus('Could not extract job data from this page.');
      analyzeBtn.disabled = false;
      return;
    }

    setStatus('Analyzing with AI...');

    // Derive backend base URL from stored apiUrl (which points to /api/listings)
    const apiUrl = apiUrlInput.value || DEFAULT_API_URL;
    const baseUrl = apiUrl.replace(/\/api\/.*$/, '');

    const res = await fetch(`${baseUrl}/api/analyze-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Server returned ${res.status}` }));
      throw new Error(err.error || `Server returned ${res.status}`);
    }

    const result = await res.json();

    document.getElementById('cardPain').textContent = result.pain_symptom || '(not detected)';
    document.getElementById('cardRoot').textContent = result.pain_root_cause || '(not detected)';
    document.getElementById('cardPattern').textContent = result.solution_pattern || '(not detected)';
    document.getElementById('cardPitch').textContent = result.saas_pitch || '';
    analysisCard.classList.add('visible');

    setStatus(result.cached ? 'Loaded from cache.' : 'Analysis complete.');
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }

  analyzeBtn.disabled = false;
});
```

- [ ] **Step 3: Reload the extension and do end-to-end test**

1. Open `chrome://extensions`
2. Click reload (↺) on "Pangolin — Upwork Signal Capture"
3. Navigate to any live Upwork job page: `https://www.upwork.com/jobs/~01...`
4. Click the Pangolin extension icon in the toolbar
5. Verify: popup shows "Analyze this job for pain & SaaS signals" subtitle and a green "Analyze this job" button (not the blue "Capture & Send" buttons)
6. Click "Analyze this job"
7. Verify: status shows "Extracting job from page..." then "Analyzing with AI..."
8. Verify: a green card appears with Pain, Root cause, SaaS idea, and pitch paragraph populated

   If the card shows "(not detected)" for all fields, open DevTools on the Upwork job page and run:
   ```javascript
   document.querySelector('h1')?.textContent
   ```
   to verify the title is extractable. If it returns null, the content script may not have been injected — check that the extension was reloaded and the job page URL matches the manifest pattern.

- [ ] **Step 4: Verify batch mode still works**

Navigate to `https://www.upwork.com/nx/find-work/best-matches`, open the popup — it should show the original "Capture & Send" UI, not the analyze UI.

- [ ] **Step 5: Commit**

```bash
git add extension/popup.html extension/popup.js
git commit -m "feat: add single-job analyze mode to extension popup with pain/saas card"
```
