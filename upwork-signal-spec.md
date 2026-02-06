# Pangolin — Product Spec

**Project:** Tool that mines Upwork job listings to surface semi-validated SaaS ideas and buyer lists

**Status:** Spec phase — iterating before build

---

## Problem Statement

Upwork job listings are a rich signal for product ideas — every post represents someone willing to pay for a solution. But the signal is buried: you'd need to manually track hundreds of listings over weeks to spot patterns like "12 different real estate agencies all need the same CRM integration."

This tool automates that pattern recognition and — critically — captures buyer information so you don't just get an idea, you get your first 50 potential customers.

---

## Core Concept

**Input:** Upwork job listings captured via Chrome extension or manual paste
**Processing:** AI extracts structured fields, clusters by underlying problem
**Output:** Ranked opportunity clusters with attached buyer lists

The tool should answer two questions:
1. **What should I build?** (recurring problems, high frequency, decent budgets)
2. **Who are my first customers?** (the people already paying freelancers to solve this)

---

## Architecture

### Chrome Extension (lightweight data grabber)
- Runs on Upwork search/feed pages
- Reads visible listing data from the DOM: title, description, budget, skills, category, client info
- "Capture" button that sends batch to the web app (or copies structured JSON to clipboard as fallback)
- Minimal logic — just extraction, no AI processing

### Web App (where the brains live)
- Paste/import listings (JSON from extension or manual paste)
- AI processing pipeline (Claude API)
- Dashboard with cluster views, buyer lists, trend tracking
- Enrichment pipeline for buyer research

---

## Data Model

### Per Listing — Problem Signal
- Title
- Description
- Budget (fixed or hourly + range)
- Skills / tags
- Category
- AI-extracted fields:
  - **Problem category** (semantic, not keyword-based)
  - **Vertical / industry**
  - **Workflow described**
  - **Tools mentioned**
  - **Recurring indicator** (has this client posted similar jobs before?)

### Per Listing — Buyer Signal
- Client name / company name
- Client Upwork history (jobs posted, total spent, hire rate)
- Industry vertical
- Company size indicators (from description context clues)
- Location
- Link to Upwork profile
- External identifiers (company name → LinkedIn, website — via enrichment)

---

## Views / Reports

### 1. Opportunity Clusters
Grouped by AI-determined problem category:
- Number of listings in cluster
- Frequency over time
- Average budget
- **Heat score** = frequency × budget × recency
- "Representative listing" — best example of the problem
- Click into cluster → see all listings

### 2. Buyer List (per cluster)
For each opportunity cluster, who's asking for it:
- All clients who posted jobs in that cluster
- Company info, spend history, vertical
- Enrichment status (did we find their LinkedIn/website?)
- Exportable as CSV for outreach

### 3. Buyer Enrichment Pipeline
Semi-automated research on buyers in hot clusters:
- Company name → web lookup for website, LinkedIn, company size
- Could use Claude API + web search, or manual "research this company" button
- Goal: build lightweight CRM-style list for outreach

### 4. Trend View (unlocks after weeks of data)
- How clusters evolve over time
- New vs. saturated vs. declining clusters
- Emerging opportunities

---

## User Workflow

1. Browse Upwork → extension captures 20-50 listings per session
2. App processes them, slots into existing clusters or creates new ones
3. Check dashboard weekly — "real estate CRM integration" just hit 15 listings across 12 clients, avg budget $3k
4. Click into cluster → see the 12 clients, their profiles, spend history
5. Hit "enrich" → app pulls company websites, LinkedIn pages
6. Export buyer list → cold outreach or build a landing page against the validated idea

---

## AI Processing Details

### Why semantic clustering matters
Keyword matching won't cut it. The AI needs to recognize that:
- "connect our CRM to our transaction management"
- "automate our closing workflow"
- "integrate DocuSign with our database"

...are essentially the same underlying need.

### Extraction prompt (per listing)
Send each listing through Claude API to extract:
```json
{
  "problem_category": "CRM-transaction management integration",
  "vertical": "Real Estate",
  "workflow_described": "Agent closes deal → manually enters data in CRM → sends DocuSign → manually tracks status",
  "tools_mentioned": ["DocuSign", "Salesforce", "dotloop"],
  "budget_tier": "mid", 
  "is_recurring_type_need": true,
  "buyer_company_name": "Keller Williams - Austin",
  "buyer_industry": "Real Estate Brokerage"
}
```

### Clustering approach
- Embed extracted problem_category fields
- Group by cosine similarity
- Allow human override / merge of clusters

---

## Tech Stack

- **Chrome Extension:** Vanilla JS, minimal permissions (reads DOM on upwork.com)
- **Frontend:** React (Next.js)
- **Backend:** Next.js API routes
- **Database:** PostgreSQL
  - Tables: listings, clusters, buyers, enrichment_data
- **AI Layer:** Claude API (extraction + clustering)
- **Optional:** Simple queue for enrichment jobs (Bull or similar)

---

## MVP Phases

### Phase 1 — Core Loop
- Chrome extension + paste import
- AI extraction pipeline
- Cluster view with heat scores
- Basic listing detail view

### Phase 2 — Buyer Intelligence
- Buyer profiles attached to clusters
- Manual enrichment ("research this company" button)
- Export buyer lists as CSV

### Phase 3 — Trend Tracking + Automation
- Automated enrichment pipeline
- Trend view (cluster growth/decline over time)
- Alerts for emerging hot clusters

### Phase 4 — Productize
- Multi-user support
- Additional data sources (Reddit, G2, indie hacker forums)
- Paid product for indie hackers / builders

---

## Data & Legal Considerations

- **Not scraping Upwork at scale** — capturing what you're already browsing as a user (meaningful distinction)
- Client profile data is viewed as a logged-in Upwork user
- Company name → LinkedIn/website lookup is a manual-ish enrichment step
- For productized version: users build their own dataset from their own browsing
- No storing Upwork credentials or accessing their API without authorization

---

## Resolved Design Decisions

### Clustering Granularity
Start loose, let users split clusters manually. Easier to merge than untangle. Target specificity level: "could this be one product?" — so not "CRM integration" (too broad) but "DocuSign-to-Salesforce sync for real estate agents" (right level). AI extraction includes a specificity tier (industry + workflow + tool stack), cluster at the workflow level by default.

### Multi-Category Listings
Tag into multiple clusters, mark as "multi-signal." A listing touching both CRM integration AND lead nurturing is more valuable — shows interconnected pain points. Show in both clusters with a subtle indicator it appears elsewhere. Don't overthink.

### Heat Score Recency Weighting
Yes, decay applied: this week = 1.0x, last month = 0.7x, older = 0.4x. Also include a "velocity" indicator — cluster grew 3x in the last 2 weeks — which is a stronger signal than raw count.

### Enrichment Data Priority (for outreach)
In order of value:
1. Company website (personalize outreach)
2. Company size / employee count (filter solopreneurs vs. real businesses)
3. Tech stack if detectable (integration surface area)
4. LinkedIn of decision maker (actual outreach target)
Funding stage is less relevant — Upwork SMBs, not VC-backed startups.

### Naming
**Pangolin** — quirky, memorable, great mascot potential. The animal digs through layers to surface hidden value.
