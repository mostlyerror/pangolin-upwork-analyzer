# Inbox List Redesign + Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the card-based inbox with a dense single-line list and add an `/inbox/[id]` detail page so listings open in-app instead of linking to Upwork.

**Architecture:** Four tasks in dependency order — schema first, then the PATCH API route, then the redesigned inbox list, then the detail page. No test runner exists; `npm run build` (TypeScript + Next.js compile) is the verification gate after each task. The detail page is a server component; status action buttons are a small `'use client'` component that calls the PATCH route and redirects.

**Tech Stack:** Next.js 15 App Router, TypeScript, PostgreSQL (`pg` via `web/src/lib/db.ts`), Tailwind (not used — existing pages use inline styles; follow that pattern).

---

## File Map

| File | Change |
|------|--------|
| `schema.sql` | Add `review_status` column + index |
| `web/src/types/index.ts` | Add `review_status` to `Listing` interface |
| `web/src/app/api/listings/[id]/route.ts` | Create — PATCH handler for status transitions |
| `web/src/app/inbox/page.tsx` | Rewrite — dense list replacing card grid |
| `web/src/app/inbox/[id]/page.tsx` | Create — detail page |

---

## Task 1: Schema Migration + Type Update

**Files:**
- Modify: `schema.sql`
- Modify: `web/src/types/index.ts`

- [ ] **Step 1: Add review_status to schema.sql**

Open `schema.sql`. After the `created_at` column in the `listings` table definition, add:

```sql
    review_status   TEXT NOT NULL DEFAULT 'inbox'
                    CHECK (review_status IN ('inbox', 'archived', 'promoted')),
```

Also add the index at the bottom of the file, after the existing indexes:

```sql
CREATE INDEX idx_listings_review_status ON listings(review_status);
```

- [ ] **Step 2: Run the migration on the live database**

```bash
psql $DATABASE_URL -c "
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'inbox'
  CHECK (review_status IN ('inbox', 'archived', 'promoted'));

CREATE INDEX IF NOT EXISTS idx_listings_review_status ON listings(review_status);
"
```

Expected output:
```
ALTER TABLE
CREATE INDEX
```

Verify the column exists:
```bash
psql $DATABASE_URL -c "\d listings" | grep review_status
```

Expected: a line containing `review_status` and `text`.

- [ ] **Step 3: Add review_status to the Listing type**

Open `web/src/types/index.ts`. In the `Listing` interface, add after `saas_pitch`:

```typescript
  review_status: "inbox" | "archived" | "promoted";
```

- [ ] **Step 4: Verify the build passes**

```bash
cd web && npm run build
```

Expected: exits 0 with no TypeScript errors. The existing inbox page will show type errors if `review_status` is missing from queries — they'll be fixed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add schema.sql web/src/types/index.ts
git commit -m "feat: add review_status to listings schema and Listing type"
```

---

## Task 2: PATCH /api/listings/[id]

**Files:**
- Create: `web/src/app/api/listings/[id]/route.ts`

- [ ] **Step 1: Create the route file**

Create `web/src/app/api/listings/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

const VALID_STATUSES = ["inbox", "archived", "promoted"] as const;
type ReviewStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body: unknown = await req.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("review_status" in body) ||
    !VALID_STATUSES.includes((body as Record<string, unknown>).review_status as ReviewStatus)
  ) {
    return NextResponse.json(
      { error: "review_status must be one of: inbox, archived, promoted" },
      { status: 400 }
    );
  }

  const review_status = (body as { review_status: ReviewStatus }).review_status;

  const row = await queryOne<{ id: number }>(
    "UPDATE listings SET review_status = $1 WHERE id = $2 RETURNING id",
    [review_status, numId]
  );

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify the build passes**

```bash
cd web && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Smoke test the route**

Start the dev server in one terminal:
```bash
cd web && npm run dev
```

In another terminal, pick a real listing ID from the database:
```bash
psql $DATABASE_URL -c "SELECT id, title FROM listings LIMIT 1;"
```

Then call the route (replace `123` with the actual id):
```bash
curl -s -X PATCH http://localhost:3939/api/listings/123 \
  -H "Content-Type: application/json" \
  -d '{"review_status":"archived"}' | jq
```

Expected: `{ "ok": true }`

Verify the DB updated:
```bash
psql $DATABASE_URL -c "SELECT id, review_status FROM listings WHERE id = 123;"
```

Reset it back:
```bash
curl -s -X PATCH http://localhost:3939/api/listings/123 \
  -H "Content-Type: application/json" \
  -d '{"review_status":"inbox"}' | jq
```

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/listings/[id]/route.ts
git commit -m "feat: PATCH /api/listings/[id] — review_status transitions"
```

---

## Task 3: Inbox List Redesign

**Files:**
- Modify: `web/src/app/inbox/page.tsx`

- [ ] **Step 1: Rewrite the inbox page**

Replace the entire contents of `web/src/app/inbox/page.tsx` with:

```tsx
import { query } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface InboxRow {
  id: number;
  upwork_url: string | null;
  title: string;
  budget_type: "fixed" | "hourly" | null;
  budget_min: number | null;
  budget_max: number | null;
  captured_at: string;
  ai_processed_at: string | null;
  ai_error: string | null;
  review_status: "inbox" | "archived" | "promoted";
}

function formatBudget(row: InboxRow): string | null {
  const min = row.budget_min == null ? null : Number(row.budget_min);
  const max = row.budget_max == null ? null : Number(row.budget_max);
  if (min == null && max == null) return null;

  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const suffix = row.budget_type === "hourly" ? "/hr" : "";

  if (min != null && max != null && min !== max) {
    return `${fmt.format(min)}–${fmt.format(max)}${suffix}`;
  }
  return `${fmt.format(min ?? max ?? 0)}${suffix}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function StatusPill({ row }: { row: InboxRow }) {
  if (row.ai_error) {
    return (
      <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700, flexShrink: 0, width: 38, textAlign: "center", display: "inline-block" }}>
        ERR
      </span>
    );
  }
  if (row.ai_processed_at) {
    return (
      <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700, flexShrink: 0, width: 38, textAlign: "center", display: "inline-block" }}>
        DONE
      </span>
    );
  }
  return (
    <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700, flexShrink: 0, width: 38, textAlign: "center", display: "inline-block" }}>
      RAW
    </span>
  );
}

export default async function InboxPage() {
  const listings = await query<InboxRow>(
    `SELECT id, upwork_url, title, budget_type, budget_min, budget_max,
            captured_at, ai_processed_at, ai_error, review_status
       FROM listings
      WHERE review_status = 'inbox'
      ORDER BY captured_at DESC
      LIMIT 200`
  );

  const total = listings.length;
  const raw = listings.filter((l) => !l.ai_processed_at && !l.ai_error).length;
  const done = listings.filter((l) => l.ai_processed_at).length;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 56px" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Inbox</h1>
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#64748b" }}>
          <span>{total} total</span>
          <span>{raw} raw</span>
          <span>{done} processed</span>
        </div>
      </header>

      {listings.length === 0 ? (
        <div style={{ border: "1px solid #e2e8f0", background: "white", padding: 24, borderRadius: 8 }}>
          <p style={{ color: "#64748b" }}>No inbox listings. Capture jobs from the Chrome extension.</p>
        </div>
      ) : (
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
          {listings.map((listing, i) => {
            const budget = formatBudget(listing);
            const date = formatDate(listing.captured_at);
            const isLast = i === listings.length - 1;

            return (
              <Link
                key={listing.id}
                href={`/inbox/${listing.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 14px",
                  borderBottom: isLast ? "none" : "1px solid #f1f5f9",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <StatusPill row={listing} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {listing.title}
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {[budget, date].filter(Boolean).join(" · ")}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build passes**

```bash
cd web && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Verify in browser**

```bash
cd web && npm run dev
```

Open `http://localhost:3939/inbox`. Verify:
- Each listing is a single row: status pill · title · budget/date
- No cards or description text visible in the list
- Clicking a row navigates to `/inbox/[id]` (404 is fine for now — detail page is next task)
- The stat strip shows correct counts

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/inbox/page.tsx
git commit -m "feat: redesign inbox list as dense single-line rows"
```

---

## Task 4: Detail Page /inbox/[id]

**Files:**
- Create: `web/src/app/inbox/[id]/page.tsx`

- [ ] **Step 1: Create the detail page**

Create `web/src/app/inbox/[id]/page.tsx`:

```tsx
import { queryOne } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Listing } from "@/types";
import StatusActions from "./StatusActions";

export const dynamic = "force-dynamic";

function formatBudget(listing: Listing): string | null {
  const min = listing.budget_min == null ? null : Number(listing.budget_min);
  const max = listing.budget_max == null ? null : Number(listing.budget_max);
  if (min == null && max == null) return null;

  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const suffix = listing.budget_type === "hourly" ? "/hr" : "";

  if (min != null && max != null && min !== max) {
    return `${fmt.format(min)}–${fmt.format(max)} ${listing.budget_type ?? ""}${suffix}`;
  }
  return `${fmt.format(min ?? max ?? 0)} ${listing.budget_type ?? ""}${suffix}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatusBadge({ listing }: { listing: Listing }) {
  if (listing.ai_error) {
    return <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>ERR</span>;
  }
  if (listing.ai_processed_at) {
    return <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>DONE</span>;
  }
  return <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>RAW</span>;
}

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: 3, letterSpacing: "0.05em" }}>
      {children}
    </div>
  );
}

export default async function InboxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) notFound();

  const listing = await queryOne<Listing>(
    "SELECT * FROM listings WHERE id = $1",
    [numId]
  );

  if (!listing) notFound();

  const budget = formatBudget(listing);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 56px" }}>
      {/* Nav bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: "1px solid #e2e8f0",
        flexWrap: "wrap",
      }}>
        <a href="/inbox" style={{ color: "#6366f1", fontSize: 13, textDecoration: "none", marginRight: 4 }}>
          ← Inbox
        </a>
        <StatusBadge listing={listing} />
        <div style={{ flex: 1 }} />
        <StatusActions listingId={listing.id} upworkUrl={listing.upwork_url} />
      </div>

      {/* Title */}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", lineHeight: 1.3, marginBottom: 16 }}>
        {listing.title}
      </h1>

      {/* Description */}
      <div style={{
        color: "#334155",
        fontSize: 14,
        lineHeight: 1.7,
        marginBottom: 24,
        whiteSpace: "pre-wrap",
        paddingBottom: 24,
        borderBottom: "1px solid #f1f5f9",
      }}>
        {listing.description ?? <span style={{ color: "#94a3b8" }}>No description captured.</span>}
      </div>

      {/* Metadata grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px", marginBottom: 24 }}>
        {budget && (
          <div>
            <MetaLabel>Budget</MetaLabel>
            <div style={{ fontSize: 13, color: "#475569" }}>{budget}</div>
          </div>
        )}
        <div>
          <MetaLabel>Captured</MetaLabel>
          <div style={{ fontSize: 13, color: "#475569" }}>{formatDateTime(listing.captured_at)}</div>
        </div>
        {listing.posted_at && (
          <div>
            <MetaLabel>Posted</MetaLabel>
            <div style={{ fontSize: 13, color: "#475569" }}>{formatDateTime(listing.posted_at)}</div>
          </div>
        )}
        {listing.skills && listing.skills.length > 0 && (
          <div style={{ gridColumn: "span 2" }}>
            <MetaLabel>Skills</MetaLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {listing.skills.map((skill) => (
                <span
                  key={skill}
                  style={{ border: "1px solid #e2e8f0", borderRadius: 99, color: "#475569", padding: "2px 10px", fontSize: 12 }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI section — only when processed */}
      {listing.ai_processed_at && !listing.ai_error && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.05em", marginBottom: 12 }}>
            AI Processed
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
            {listing.vertical && (
              <div>
                <MetaLabel>Vertical</MetaLabel>
                <div style={{ fontSize: 13, color: "#475569" }}>{listing.vertical}</div>
              </div>
            )}
            {listing.budget_tier && (
              <div>
                <MetaLabel>Budget tier</MetaLabel>
                <div style={{ fontSize: 13, color: "#475569" }}>{listing.budget_tier}</div>
              </div>
            )}
            {listing.tools_mentioned && listing.tools_mentioned.length > 0 && (
              <div style={{ gridColumn: "span 2" }}>
                <MetaLabel>Tools mentioned</MetaLabel>
                <div style={{ fontSize: 13, color: "#475569" }}>{listing.tools_mentioned.join(", ")}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {listing.ai_error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#991b1b", letterSpacing: "0.05em", marginBottom: 6 }}>
            AI Error
          </div>
          <div style={{ fontSize: 13, color: "#7f1d1d" }}>{listing.ai_error}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the StatusActions client component**

Create `web/src/app/inbox/[id]/StatusActions.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  listingId: number;
  upworkUrl: string | null;
}

export default function StatusActions({ listingId, upworkUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: "archived" | "promoted") {
    setBusy(true);
    await fetch(`/api/listings/${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_status: status }),
    });
    router.push("/inbox");
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        onClick={() => setStatus("promoted")}
        disabled={busy}
        style={{
          background: "#6366f1",
          color: "white",
          border: "none",
          borderRadius: 6,
          padding: "5px 14px",
          fontSize: 13,
          fontWeight: 600,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        Promote
      </button>
      <button
        onClick={() => setStatus("archived")}
        disabled={busy}
        style={{
          background: "white",
          color: "#64748b",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          padding: "5px 14px",
          fontSize: 13,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        Archive
      </button>
      {upworkUrl && (
        <a
          href={upworkUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 10px", fontSize: 13, textDecoration: "none", background: "white" }}
        >
          ↗
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the build passes**

```bash
cd web && npm run build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 4: Verify in browser — end-to-end flow**

```bash
cd web && npm run dev
```

Golden path:
1. Open `http://localhost:3939/inbox`
2. Confirm rows are dense (one line each) with status pill · title · budget/date
3. Click any row — confirm it opens `/inbox/[id]` with the full detail page
4. Verify: title, full description (or placeholder), metadata grid, Upwork ↗ link (if url exists)
5. Click **Archive** — confirm redirect back to `/inbox` and the listing is gone from the list
6. Click **Promote** on another listing — same redirect and removal from inbox

Check that promoted/archived items no longer appear (they have `review_status != 'inbox'`).

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/inbox/[id]/page.tsx web/src/app/inbox/[id]/StatusActions.tsx
git commit -m "feat: add /inbox/[id] detail page with promote and archive actions"
```

---

## Final Verification

- [ ] **Full build check**

```bash
cd web && npm run build
```

Expected: exits 0.

- [ ] **Extension sandbox still passes**

```bash
node scripts/extension-sandbox.mjs
```

Expected: passes (this tests the capture endpoint which wasn't touched).
