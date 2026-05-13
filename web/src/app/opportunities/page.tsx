import { query } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface OpportunityRow {
  id: number;
  title: string;
  budget_type: "fixed" | "hourly" | null;
  budget_min: number | null;
  budget_max: number | null;
  captured_at: string | Date;
  ai_processed_at: string | Date | null;
  ai_error: string | null;
  vertical: string | null;
  saas_pitch: string | null;
}

function formatBudget(row: OpportunityRow): string | null {
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

export default async function OpportunitiesPage() {
  const listings = await query<OpportunityRow>(
    `SELECT id, title, budget_type, budget_min, budget_max,
            captured_at, ai_processed_at, ai_error, vertical, saas_pitch
       FROM listings
      WHERE review_status = 'promoted'
      ORDER BY captured_at DESC
      LIMIT 200`
  );

  const processed = listings.filter((l) => l.ai_processed_at && !l.ai_error).length;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 56px" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Opportunities</h1>
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#64748b" }}>
          <span>{listings.length} total</span>
          <span>{processed} AI-processed</span>
        </div>
      </header>

      {listings.length === 0 ? (
        <div style={{ border: "1px solid #e2e8f0", background: "white", padding: 24, borderRadius: 8 }}>
          <p style={{ color: "#64748b" }}>
            No opportunities yet. Promote listings from the{" "}
            <Link href="/inbox" style={{ color: "#6366f1" }}>inbox</Link>.
          </p>
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
                  padding: "9px 14px",
                  borderBottom: isLast ? "none" : "1px solid #f1f5f9",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1e293b",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginBottom: listing.vertical || listing.saas_pitch ? 2 : 0,
                  }}>
                    {listing.title}
                  </div>
                  {(listing.vertical || listing.saas_pitch) && (
                    <div style={{
                      fontSize: 12,
                      color: "#64748b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {listing.vertical && (
                        <span style={{
                          background: "#ede9fe",
                          color: "#5b21b6",
                          borderRadius: 4,
                          padding: "1px 6px",
                          fontSize: 11,
                          fontWeight: 500,
                          marginRight: 6,
                        }}>
                          {listing.vertical}
                        </span>
                      )}
                      {listing.saas_pitch ?? ""}
                    </div>
                  )}
                </div>
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
