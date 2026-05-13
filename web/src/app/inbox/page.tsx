import { query } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface InboxRow {
  id: number;
  title: string;
  budget_type: "fixed" | "hourly" | null;
  budget_min: number | null;
  budget_max: number | null;
  captured_at: string | Date;
  ai_processed_at: string | Date | null;
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

function formatDate(value: string | Date): string {
  const d = value instanceof Date
    ? value
    : new Date(value.endsWith("Z") ? value : value + "Z");
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
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
    `SELECT id, title, budget_type, budget_min, budget_max,
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
