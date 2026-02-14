import { BarInline } from "./BarInline";
import { Section } from "./Section";
import { ProductBriefCard } from "./ProductBriefCard";
import { ListingCard } from "./ListingCard";
import { fmt$ } from "./helpers";
import type { VerticalDetail, ProductBrief, Cluster } from "./types";

export function VerticalDetailView({
  detail,
  productBrief,
  briefLoading,
  onGenerateBrief,
  onClusterClick,
  clusters,
  onFeedback,
  onReassign,
}: {
  detail: VerticalDetail;
  productBrief: ProductBrief | null;
  briefLoading: boolean;
  onGenerateBrief: () => void;
  onClusterClick: (clusterId: number) => void;
  clusters?: Cluster[];
  onFeedback?: (listingId: number, clusterId: number | null, type: string) => void;
  onReassign?: (listingId: number, oldClusterId: number, newClusterId: number) => void;
}) {
  const { summary, clusterOverlaps, topProblemCategories, toolHeatmap, jobTierDist, durationDist, geography, paymentVerification, barrierToEntry, listings } = detail;

  const maxClusterCount = Math.max(
    ...clusterOverlaps.map((c) => Number(c.listing_count)),
    1
  );
  const maxProblemCount = Math.max(
    ...topProblemCategories.map((p) => Number(p.count)),
    1
  );
  const maxToolCount = Math.max(
    ...toolHeatmap.map((t) => Number(t.mention_count)),
    1
  );
  const maxJobTierCount = Math.max(
    ...jobTierDist.map((t) => Number(t.count)),
    1
  );
  const maxDurationCount = Math.max(
    ...durationDist.map((d) => Number(d.count)),
    1
  );
  const maxGeoBuyers = Math.max(
    ...geography.map((g) => Number(g.buyer_count)),
    1
  );

  const tierColors: Record<string, string> = {
    Expert: "#7c3aed",
    Intermediate: "#2563eb",
    Entry: "#059669",
  };

  const recurringCount = Number(summary.recurring_count ?? 0);
  const oneOffCount = Number(summary.one_off_count ?? 0);
  const totalRecurring = recurringCount + oneOffCount;
  const recurringPct = totalRecurring > 0 ? Math.round((recurringCount / totalRecurring) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <h1 style={{ marginBottom: 0 }}>{summary.vertical}</h1>
      <p style={{ color: "#666", marginBottom: 16, marginTop: 4 }}>
        Industry vertical &middot; {summary.listing_count} listings
      </p>

      {/* Product Brief */}
      <ProductBriefCard
        brief={productBrief}
        loading={briefLoading}
        onGenerate={onGenerateBrief}
      />

      {/* Metrics row */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 24,
          fontSize: 14,
          color: "#666",
          flexWrap: "wrap",
        }}
      >
        <span>
          {summary.listing_count} listings
        </span>
        <span>
          Avg budget: {fmt$(summary.avg_budget)}
        </span>
        <span>
          Total: {fmt$(summary.total_budget)}
        </span>
        <span>
          {summary.buyer_count} buyers
        </span>
        <span style={{ color: "#059669", fontWeight: 600 }}>
          {recurringPct}% recurring
        </span>
        {paymentVerification && paymentVerification.verification_rate !== null && (
          <span style={{ color: "#059669" }}>
            {paymentVerification.verification_rate}% verified
          </span>
        )}
        {barrierToEntry && barrierToEntry.avg_connect_price !== null && (
          <span>
            Avg connects: {barrierToEntry.avg_connect_price}
          </span>
        )}
      </div>

      {/* Sections grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Cluster Overlaps */}
        {clusterOverlaps.length > 0 && (
          <Section title="Clusters">
            {clusterOverlaps.map((c) => (
              <div
                key={c.cluster_id}
                style={{
                  marginBottom: 8,
                  cursor: "pointer",
                }}
                onClick={() => onClusterClick(c.cluster_id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f0f9ff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontWeight: 500, color: "#2563eb" }}>{c.cluster_name}</span>
                  <span style={{ color: "#888" }}>{c.listing_count}</span>
                </div>
                <BarInline
                  value={Number(c.listing_count)}
                  max={maxClusterCount}
                  color="#2563eb"
                  label="listings"
                />
              </div>
            ))}
          </Section>
        )}

        {/* Problem Categories */}
        {topProblemCategories.length > 0 && (
          <Section title="Top Problems">
            {topProblemCategories.map((p) => (
              <div key={p.category} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{p.category}</span>
                  <span style={{ color: "#888" }}>
                    {p.count} &middot; {fmt$(p.avg_budget)}
                  </span>
                </div>
                <BarInline
                  value={Number(p.count)}
                  max={maxProblemCount}
                  color="#7c3aed"
                  label="listings"
                />
              </div>
            ))}
          </Section>
        )}

        {/* Tech Stack */}
        {toolHeatmap.length > 0 && (
          <Section title="Tech Stack">
            {toolHeatmap.map((t) => (
              <div key={t.tool} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{t.tool}</span>
                  <span style={{ color: "#888" }}>{t.mention_count}</span>
                </div>
                <BarInline
                  value={Number(t.mention_count)}
                  max={maxToolCount}
                  color="#d946ef"
                  label="mentions"
                />
              </div>
            ))}
          </Section>
        )}

        {/* Job Quality */}
        {jobTierDist.length > 0 && (
          <Section title="Job Quality">
            {jobTierDist.map((t) => (
              <div key={t.job_tier} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{t.job_tier}</span>
                  <span style={{ color: "#888" }}>{t.count}</span>
                </div>
                <BarInline
                  value={Number(t.count)}
                  max={maxJobTierCount}
                  color={tierColors[t.job_tier] ?? "#6b7280"}
                  label="listings"
                />
              </div>
            ))}
          </Section>
        )}

        {/* Engagement Duration */}
        {durationDist.length > 0 && (
          <Section title="Engagement Duration">
            {durationDist.map((d) => (
              <div key={d.duration} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{d.duration}</span>
                  <span style={{ color: "#888" }}>{d.count}</span>
                </div>
                <BarInline
                  value={Number(d.count)}
                  max={maxDurationCount}
                  color="#f59e0b"
                  label="listings"
                />
              </div>
            ))}
          </Section>
        )}

        {/* Geography */}
        {geography.length > 0 && (
          <Section title="Geography">
            {geography.map((g) => (
              <div key={g.location} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{g.location}</span>
                  <span style={{ color: "#888" }}>{g.buyer_count} buyers</span>
                </div>
                <BarInline
                  value={Number(g.buyer_count)}
                  max={maxGeoBuyers}
                  color="#0891b2"
                  label="buyers"
                />
              </div>
            ))}
          </Section>
        )}
      </div>

      {/* Listings */}
      <h2 style={{ marginBottom: 8 }}>Listings ({listings.length})</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            tierColors={tierColors}
            clusters={clusters}
            onFeedback={onFeedback}
            onReassign={onReassign}
          />
        ))}
      </div>
    </div>
  );
}
