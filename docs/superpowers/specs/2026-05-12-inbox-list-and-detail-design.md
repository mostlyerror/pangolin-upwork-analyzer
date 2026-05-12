# Spec: Inbox List Redesign + Detail Page

## Objective

Two changes to the current app:

1. Replace the card-based inbox list with a dense single-line row layout.
2. Add a detail page at `/inbox/[id]` so listings open in-app instead of linking directly to Upwork.

## Schema Change

Add `review_status` to the `listings` table:

```sql
ALTER TABLE listings
  ADD COLUMN review_status TEXT NOT NULL DEFAULT 'inbox'
  CHECK (review_status IN ('inbox', 'archived', 'promoted'));

CREATE INDEX idx_listings_review_status ON listings(review_status);
```

The inbox list defaults to showing `review_status = 'inbox'`. Promoting or archiving a listing updates this field via a PATCH API route and removes it from the default inbox view.

## Inbox List (`/inbox`)

**Layout:** Replace the card grid with a flat list. Each row is one line:

```
[STATUS] Title ·········································· $budget · date
```

- **Status pill**: fixed-width left anchor, pill/badge style. Values: `RAW` (amber), `DONE` (green), `ERR` (red). Derived from `ai_processed_at` and `ai_error`.
- **Title**: truncates with ellipsis if too long.
- **Budget + date**: right-aligned, muted (gray). Budget omitted if null. Date is `captured_at` formatted as `May 12`.
- **Clicking a row** navigates to `/inbox/[id]`.
- **Stat strip** at the top (Total / Raw / Processed counts) is retained.
- **Empty state** is retained.

The page stays a server component — no client-side state needed.

## Detail Page (`/inbox/[id]`)

New route: `web/src/app/inbox/[id]/page.tsx`. Server component. Fetches the listing by `id` from `listings`. Returns 404 if not found.

### Layout (top to bottom)

**Nav bar**
- `← Inbox` link (left)
- Status badge (right of link): `RAW` / `DONE` / `ERR`
- `Promote` button — indigo, updates `review_status = 'promoted'`, redirects to `/inbox`
- `Archive` button — neutral border, updates `review_status = 'archived'`, redirects to `/inbox`
- `↗` icon link to `upwork_url` — only rendered if `upwork_url` is not null

**Title**
Large, bold. No link.

**Description**
Full text, no truncation. Preserves line breaks. If null, show a muted "No description captured" placeholder.

**Metadata grid (2 columns)**
- Budget: formatted as `$min–$max fixed` or `$rate/hr` or `—` if null
- Captured: `May 12, 2026 at 9:04am`
- Posted: same format, omitted entirely if `posted_at` is null
- Skills: inline chips, wrapping. Omitted if empty.

**AI section** (only rendered if `ai_processed_at` is set)
Collapsed visually — light gray background block. Shows: vertical, tools mentioned (comma-separated), budget tier. Label: "AI Processed". If `ai_error` is set instead, show the error text in a red block.

### Status transitions

| Action | `review_status` becomes | Redirect |
|--------|------------------------|----------|
| Promote | `promoted` | `/inbox` |
| Archive | `archived` | `/inbox` |

No undo UI in this version.

## API Route

New route: `PATCH /api/listings/[id]`

Accepts `{ review_status: 'inbox' | 'archived' | 'promoted' }`. Validates the value, updates the row, returns `{ ok: true }`. Used by the Promote and Archive buttons (via a form action or client fetch).

Since the detail page is a server component, status actions use a small `'use client'` wrapper or Next.js server actions to POST without a full page reload — or simply a form with a redirect. Either approach is acceptable; prefer server actions for simplicity.

## Files to Create or Modify

| File | Change |
|------|--------|
| `web/src/app/inbox/page.tsx` | Rewrite list to dense rows |
| `web/src/app/inbox/[id]/page.tsx` | Create detail page |
| `web/src/app/api/listings/[id]/route.ts` | Create PATCH handler |
| `schema.sql` | Add `review_status` column + index |
| `web/src/lib/db.ts` | No change needed |

## Out of Scope

- Notes field (spec open question — deferred)
- Manual tags (deferred)
- Filtering by review_status in the list UI (deferred — show `inbox` only for now)
- Undo for archive/promote
- Keyboard shortcuts
