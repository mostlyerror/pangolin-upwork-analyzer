# Single-Job Pain Point Analyzer — Design Spec
Date: 2026-05-08

## Goal
When a user visits a single Upwork job page in Chrome, they can click the Pangolin extension popup and immediately get a pain point card and SaaS opportunity pitch for that one listing. The full extraction result is stored in the existing `listings` table for future reference.

## Architecture & Data Flow

1. User navigates to `https://www.upwork.com/jobs/~CIPHERTEXT` in Chrome
2. Extension popup detects the job-page URL pattern and shows an "Analyze this job" button instead of the batch capture UI
3. Clicking the button sends a message to the content script (`action: 'analyze'`)
4. Content script reads `document.getElementById('__NEXT_DATA__').textContent`, parses the JSON, and extracts: title, description, skills, hourly/fixed budget, and the job URL. Falls back to DOM scraping if `__NEXT_DATA__` is absent or malformed.
5. Content script returns the raw job data to the popup
6. Popup POSTs to `POST /api/analyze-single` on the backend
7. Backend checks for an existing listing with the same URL (`source = 'single'`):
   - If found and already has `pain_symptom`, returns the cached card data immediately
   - Otherwise, calls `extractListing()` (extended to include `saas_pitch`) and upserts to `listings`
8. Popup receives `{ pain_symptom, pain_root_cause, solution_pattern, saas_pitch }` and renders the card

## Schema Changes

Two new columns added to `listings`:

| Column | Type | Default | Description |
|---|---|---|---|
| `source` | `TEXT` | `'batch'` | `'batch'` for feed captures, `'single'` for per-job analysis |
| `saas_pitch` | `TEXT` | `NULL` | AI-generated paragraph describing the SaaS opportunity |

Migration:
```sql
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS source     TEXT NOT NULL DEFAULT 'batch',
  ADD COLUMN IF NOT EXISTS saas_pitch TEXT;
```

No index needed — source is informational only.

## AI Changes

### `ExtractionResult` interface (`web/src/lib/ai.ts`)
Add one new field:
```ts
saas_pitch: string | null;
```

### `extractListing` prompt
Extend the JSON schema with:
```
"saas_pitch": "One paragraph (3-5 sentences): what SaaS product could someone build to solve this pain at scale? Name the product category, who it serves, and why it's a repeatable business."
```

### Handling in `extractListing`
Map `parsed.saas_pitch ?? null` into the returned `ExtractionResult`.

## New API Endpoint

**`POST /api/analyze-single`**

Request body:
```json
{
  "title": "string",
  "description": "string | null",
  "skills": ["string"],
  "budgetMin": "number | null",
  "budgetMax": "number | null",
  "budgetType": "'hourly' | 'fixed'",
  "url": "string"
}
```

Logic:
1. Check `SELECT id, pain_symptom, pain_root_cause, solution_pattern, saas_pitch FROM listings WHERE url = $1 AND source = 'single' LIMIT 1`
2. If found and `pain_symptom IS NOT NULL`, return cached card data with `{ cached: true }`
3. Otherwise call `extractListing(title, description, skills, budgetMin, budgetMax)`
4. Upsert: `INSERT INTO listings (...) ON CONFLICT (url) DO UPDATE SET ...` — sets all extraction columns + `ai_processed_at = now()` + `source = 'single'`
5. Return `{ listing_id, pain_symptom, pain_root_cause, solution_pattern, saas_pitch, cached: false }`

Error response: `{ error: "message" }` with HTTP 500.

## Extension Changes

### `manifest.json`
Add job-page URL pattern to `content_scripts.matches`:
```json
"https://www.upwork.com/jobs/*"
```

### `content.js`
New function `extractSingleJob()`:
- Reads `document.getElementById('__NEXT_DATA__')?.textContent`
- Parses JSON and navigates to the job data (path: `props.pageProps.jobDetails` or similar — with a try/catch for path variance)
- Maps to `{ title, description, skills, budgetMin, budgetMax, budgetType, url }`
- DOM fallback: reads `h1` for title, `[data-test="description"]` for description, skill tokens for skills, and parses budget text

New message handler for `action: 'analyze'`:
```js
if (msg.action === 'analyze') {
  sendResponse(extractSingleJob());
  return true;
}
```

### `popup.html`
New hidden elements (toggled by JS):
- `#analyzeSection` — contains "Analyze this job" button (`#analyzeBtn`) and card display area (`#analysisCard`)
- `#batchSection` — existing capture UI (shown on non-job pages)

Card markup inside `#analysisCard`:
```html
<div id="painCard" class="hidden">
  <div class="card-label">Pain</div>
  <div id="cardPain"></div>
  <div class="card-label">Root cause</div>
  <div id="cardRoot"></div>
  <div class="card-divider"></div>
  <div class="card-label saas">SaaS idea</div>
  <div id="cardPattern"></div>
  <div id="cardPitch"></div>
</div>
```

### `popup.js`
On load:
```js
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const isJobPage = /upwork\.com\/jobs\/~/.test(tab.url);
document.getElementById('analyzeSection').hidden = !isJobPage;
document.getElementById('batchSection').hidden = isJobPage;
```

`analyzeBtn` click handler:
1. Send `{ action: 'analyze' }` to content script → receive raw job data
2. POST to `<apiUrl base>/api/analyze-single` with job data
3. On success: populate card fields and show `#painCard`
4. On error: show error message in status area

## Out of Scope
- Displaying `saas_pitch` on existing batch listings in the web app Discover screen
- Deduplication between single-analyzed and batch-captured listings (same URL may exist in both if captured before analyze was built)
- Loading the analyzed listing in the web app automatically after analysis
