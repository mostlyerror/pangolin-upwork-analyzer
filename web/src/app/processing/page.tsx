import { query, queryOne } from "@/lib/db";
import Link from "next/link";
import ProcessingControls from "./ProcessingControls";

export const dynamic = "force-dynamic";

interface Stats {
  total_count: string;
  raw_count: string;
  processed_count: string;
  error_count: string;
}

interface ErroredListing {
  id: number;
  title: string;
  ai_error: string;
  captured_at: string | Date;
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

export default async function ProcessingPage() {
  const [stats, errored] = await Promise.all([
    queryOne<Stats>(
      `SELECT
        COUNT(*)::text AS total_count,
        COUNT(*) FILTER (WHERE ai_processed_at IS NULL AND ai_error IS NULL)::text AS raw_count,
        COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL AND ai_error IS NULL)::text AS processed_count,
        COUNT(*) FILTER (WHERE ai_error IS NOT NULL)::text AS error_count
       FROM listings`
    ),
    query<ErroredListing>(
      `SELECT id, title, ai_error, captured_at
         FROM listings
        WHERE ai_error IS NOT NULL
        ORDER BY captured_at DESC
        LIMIT 50`
    ),
  ]);

  const rawCount = parseInt(stats?.raw_count ?? "0", 10);
  const processedCount = parseInt(stats?.processed_count ?? "0", 10);
  const errorCount = parseInt(stats?.error_count ?? "0", 10);
  const totalCount = parseInt(stats?.total_count ?? "0", 10);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 56px" }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Processing</h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Run AI extraction on captured listings to extract verticals, problem categories, and tools.
        </p>
      </header>

      {/* Stats strip */}
      <div style={{
        display: "flex",
        gap: 0,
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 28,
      }}>
        {[
          { label: "Total", value: totalCount },
          { label: "Raw", value: rawCount, highlight: rawCount > 0 },
          { label: "Processed", value: processedCount },
          { label: "Errors", value: errorCount, danger: errorCount > 0 },
        ].map(({ label, value, highlight, danger }, i, arr) => (
          <div
            key={label}
            style={{
              flex: 1,
              padding: "14px 20px",
              borderRight: i < arr.length - 1 ? "1px solid #f1f5f9" : "none",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: danger ? "#dc2626" : highlight ? "#6366f1" : "#1e293b" }}>
              {value}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Extraction controls */}
      <div style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: 20,
        marginBottom: 28,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>AI Extraction</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16, margin: "4px 0 16px" }}>
          Extracts vertical, problem category, tools, pain/solution, and budget tier from raw listings using Claude.
        </p>
        <ProcessingControls rawCount={rawCount} />
      </div>

      {/* Error list */}
      {errored.length > 0 && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            Extraction Errors ({errored.length})
          </h2>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            {errored.map((listing, i) => (
              <Link
                key={listing.id}
                href={`/inbox/${listing.id}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 14px",
                  borderBottom: i < errored.length - 1 ? "1px solid #f1f5f9" : "none",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  borderRadius: 4,
                  padding: "1px 6px",
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  ERR
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1e293b",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginBottom: 2,
                  }}>
                    {listing.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {listing.ai_error}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "#94a3b8", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {formatDate(listing.captured_at)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
