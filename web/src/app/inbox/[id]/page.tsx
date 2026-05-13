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
    timeZone: "UTC",
  }).format(new Date(value.endsWith("Z") ? value : value + "Z"));
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

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", lineHeight: 1.3, marginBottom: 16 }}>
        {listing.title}
      </h1>

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
