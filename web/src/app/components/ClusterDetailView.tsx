import { BarInline } from "./BarInline";
import { Section } from "./Section";
import { ProductBriefCard } from "./ProductBriefCard";
import { ListingCard } from "./ListingCard";
import { fmt$, btnStyle } from "./helpers";
import type { Cluster, ClusterDetail, ProductBrief } from "./types";

export function ClusterDetailView({
  detail,
  clusters,
  selectedClusterId,
  editing,
  setEditing,
  editName,
  setEditName,
  editDesc,
  setEditDesc,
  handleRename,
  showMerge,
  setShowMerge,
  mergeTarget,
  setMergeTarget,
  merging,
  handleMerge,
  onGenerateInterpretation,
  interpretationLoading,
  productBrief,
  briefLoading,
  onGenerateBrief,
  onFeedback,
  onReassign,
}: {
  detail: ClusterDetail;
  clusters: Cluster[];
  selectedClusterId: number;
  editing: boolean;
  setEditing: (v: boolean) => void;
  editName: string;
  setEditName: (v: string) => void;
  editDesc: string;
  setEditDesc: (v: string) => void;
  handleRename: () => void;
  showMerge: boolean;
  setShowMerge: (v: boolean) => void;
  mergeTarget: number | null;
  setMergeTarget: (v: number | null) => void;
  merging: boolean;
  handleMerge: () => void;
  onGenerateInterpretation: () => void;
  interpretationLoading: boolean;
  productBrief: ProductBrief | null;
  briefLoading: boolean;
  onGenerateBrief: () => void;
  onFeedback?: (listingId: number, clusterId: number | null, type: string) => void;
  onReassign?: (listingId: number, oldClusterId: number, newClusterId: number) => void;
}) {
  const { cluster, listings, buyers, proposalTiers, geography, toolHeatmap, overlapListings, budgetStats, jobTierDist, durationDist, categoryDist, paymentVerification, barrierToEntry, clusterDates } = detail;
  const otherClusters = clusters.filter((c) => c.id !== selectedClusterId);

  // Build a set of listing IDs that overlap with other clusters
  const overlapIds = new Set((overlapListings ?? []).map((o) => o.id));
  // Map listing id -> other cluster names
  const overlapMap = new Map<number, string[]>();
  for (const o of overlapListings ?? []) {
    overlapMap.set(o.id, o.other_clusters ?? []);
  }

  // Proposal tier max for bars
  const maxProposalCount = Math.max(
    ...(proposalTiers ?? []).map((p) => Number(p.count)),
    1
  );

  // Geography max for bars
  const maxGeoBuyers = Math.max(
    ...(geography ?? []).map((g) => Number(g.buyer_count)),
    1
  );

  // Tool heatmap max
  const maxToolCount = Math.max(
    ...(toolHeatmap ?? []).map((t) => Number(t.mention_count)),
    1
  );

  // Job tier max
  const maxJobTierCount = Math.max(
    ...(jobTierDist ?? []).map((t) => Number(t.count)),
    1
  );

  // Duration max
  const maxDurationCount = Math.max(
    ...(durationDist ?? []).map((d) => Number(d.count)),
    1
  );

  // Category max
  const maxCategoryCount = Math.max(
    ...(categoryDist ?? []).map((c) => Number(c.count)),
    1
  );

  // Cluster freshness
  const latestAt = clusterDates?.latest_listing_at
    ? new Date(clusterDates.latest_listing_at)
    : null;
  const daysSinceLatest = latestAt
    ? Math.floor((Date.now() - latestAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const freshnessColor =
    daysSinceLatest !== null
      ? daysSinceLatest <= 7
        ? "#059669"
        : daysSinceLatest <= 14
        ? "#d97706"
        : "#dc2626"
      : "#9ca3af";

  // Job tier badge colors
  const tierColors: Record<string, string> = {
    Expert: "#7c3aed",
    Intermediate: "#2563eb",
    Entry: "#059669",
  };

  return (
    <div>
      {/* Header — editable */}
      {editing ? (
        <div style={{ marginBottom: 16 }}>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            style={{
              fontSize: 22,
              fontWeight: 700,
              width: "100%",
              padding: "4px 8px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              marginBottom: 8,
            }}
          />
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={2}
            style={{
              width: "100%",
              padding: "4px 8px",
              fontSize: 14,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={handleRename} style={btnStyle("#2563eb")}>
              Save
            </button>
            <button onClick={() => setEditing(false)} style={btnStyle("#6b7280")}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <h1 style={{ marginBottom: 0 }}>{cluster.name}</h1>
            <button
              onClick={() => setEditing(true)}
              style={{
                ...btnStyle("#e5e7eb"),
                color: "#374151",
                fontSize: 12,
              }}
            >
              Rename
            </button>
            <button
              onClick={() => setShowMerge(true)}
              style={{
                ...btnStyle("#e5e7eb"),
                color: "#374151",
                fontSize: 12,
              }}
            >
              Merge
            </button>
          </div>
          <p style={{ color: "#666", marginBottom: 8, marginTop: 4 }}>
            {cluster.description}
          </p>
          {/* Coherence warning badges */}
          {(() => {
            const distinctVerticals = new Set(
              listings.filter((l) => l.vertical).map((l) => l.vertical!)
            );
            const avgCount =
              clusters.length > 0
                ? clusters.reduce((s, c) => s + c.listing_count, 0) / clusters.length
                : 0;
            const showBroad = distinctVerticals.size >= 4;
            const showCatchAll = listings.length > 2 * avgCount && avgCount > 0;
            if (!showBroad && !showCatchAll) return null;
            return (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {showBroad && (
                  <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6 }}>
                    Broad: {distinctVerticals.size} verticals
                  </span>
                )}
                {showCatchAll && (
                  <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6 }}>
                    Possible catch-all ({listings.length} listings vs {Math.round(avgCount)} avg)
                  </span>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Merge panel */}
      {showMerge && (
        <div
          style={{
            padding: 16,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            Merge another cluster into &ldquo;{cluster.name}&rdquo;
          </p>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
            All listings from the selected cluster will be moved here. The source
            cluster will be deleted.
          </p>
          <select
            value={mergeTarget ?? ""}
            onChange={(e) => setMergeTarget(Number(e.target.value) || null)}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 13,
              minWidth: 300,
            }}
          >
            <option value="">Select a cluster to merge in...</option>
            {otherClusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.listing_count} listings, heat{" "}
                {Number(c.heat_score).toFixed(0)})
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={handleMerge}
              disabled={!mergeTarget || merging}
              style={btnStyle(mergeTarget && !merging ? "#dc2626" : "#d1d5db")}
            >
              {merging ? "Merging..." : "Merge"}
            </button>
            <button
              onClick={() => setShowMerge(false)}
              style={btnStyle("#6b7280")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* AI Interpretation */}
      <div
        style={{
          ...(cluster.ai_interpretation || interpretationLoading
            ? { padding: 16, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8 }
            : {}),
          marginBottom: 16,
        }}
      >
        {interpretationLoading ? (
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0369a1",
                marginBottom: 8,
              }}
            >
              Generating interpretation...
            </div>
            <div
              style={{
                height: 14,
                background: "#bae6fd",
                borderRadius: 4,
                marginBottom: 6,
                animation: "pulse 1.5s ease-in-out infinite",
                width: "90%",
              }}
            />
            <div
              style={{
                height: 14,
                background: "#bae6fd",
                borderRadius: 4,
                marginBottom: 6,
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: "0.2s",
                width: "75%",
              }}
            />
            <div
              style={{
                height: 14,
                background: "#bae6fd",
                borderRadius: 4,
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: "0.4s",
                width: "60%",
              }}
            />
            <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
          </div>
        ) : cluster.ai_interpretation ? (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span
                style={{ fontSize: 13, fontWeight: 600, color: "#0369a1" }}
              >
                AI Interpretation
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {cluster.ai_interpretation_at && (
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    Generated{" "}
                    {(() => {
                      const ago = Date.now() - new Date(cluster.ai_interpretation_at).getTime();
                      const mins = Math.floor(ago / 60000);
                      if (mins < 1) return "just now";
                      if (mins < 60) return `${mins}m ago`;
                      const hrs = Math.floor(mins / 60);
                      if (hrs < 24) return `${hrs}h ago`;
                      return `${Math.floor(hrs / 24)}d ago`;
                    })()}
                  </span>
                )}
                <button
                  onClick={onGenerateInterpretation}
                  style={{
                    ...btnStyle("#e0f2fe"),
                    color: "#0369a1",
                    fontSize: 11,
                    padding: "2px 8px",
                  }}
                >
                  Regenerate
                </button>
              </div>
            </div>
            <p style={{ fontSize: 14, color: "#1e3a5f", lineHeight: 1.6, margin: 0 }}>
              {cluster.ai_interpretation}
            </p>
          </div>
        ) : (
          <button
            onClick={onGenerateInterpretation}
            style={{
              ...btnStyle("#e0f2fe"),
              color: "#0369a1",
              fontSize: 12,
            }}
          >
            Generate AI Interpretation
          </button>
        )}
      </div>

      {/* Product Brief */}
      <ProductBriefCard
        brief={productBrief}
        loading={briefLoading}
        onGenerate={onGenerateBrief}
      />

      {/* Extended metrics row */}
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
          Heat: <strong>{Number(cluster.heat_score).toFixed(0)}</strong>
        </span>
        <span>{cluster.listing_count} listings</span>
        <span>
          Avg budget:{" "}
          {cluster.avg_budget
            ? "$" + Math.round(Number(cluster.avg_budget)).toLocaleString()
            : "—"}
        </span>
        <span>Velocity: {Number(cluster.velocity).toFixed(1)}x</span>
        {budgetStats && (
          <>
            <span>
              Range: {fmt$(budgetStats.budget_floor)}–{fmt$(budgetStats.budget_ceiling)}
            </span>
            <span>
              Stddev: {fmt$(budgetStats.budget_stddev)}
            </span>
          </>
        )}
        {overlapListings && overlapListings.length > 0 && (
          <span style={{ color: "#7c3aed" }}>
            {overlapListings.length} overlapping
          </span>
        )}
        {daysSinceLatest !== null && (
          <span style={{ color: freshnessColor, fontWeight: 600 }}>
            Last listing: {daysSinceLatest}d ago
          </span>
        )}
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
        {barrierToEntry && (Number(barrierToEntry.enterprise_count) > 0 || Number(barrierToEntry.premium_count) > 0) && (
          <span style={{ color: "#7c3aed" }}>
            {Number(barrierToEntry.enterprise_count) > 0 && `${barrierToEntry.enterprise_count} enterprise`}
            {Number(barrierToEntry.enterprise_count) > 0 && Number(barrierToEntry.premium_count) > 0 && " · "}
            {Number(barrierToEntry.premium_count) > 0 && `${barrierToEntry.premium_count} premium`}
          </span>
        )}
      </div>

      {/* Sections grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Competition / Proposal Tiers */}
        {proposalTiers && proposalTiers.length > 0 && (
          <Section title="Competition">
            {proposalTiers.map((p) => (
              <div key={p.proposal_tier} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{p.proposal_tier}</span>
                  <span style={{ color: "#888" }}>{p.count}</span>
                </div>
                <BarInline
                  value={Number(p.count)}
                  max={maxProposalCount}
                  color="#ef4444"
                  label="listings"
                />
              </div>
            ))}
          </Section>
        )}

        {/* Geography */}
        {geography && geography.length > 0 && (
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

        {/* Tech Stack */}
        {toolHeatmap && toolHeatmap.length > 0 && (
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

        {/* Job Quality / Tier Distribution */}
        {jobTierDist && jobTierDist.length > 0 && (
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
        {durationDist && durationDist.length > 0 && (
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

        {/* Upwork Categories */}
        {categoryDist && categoryDist.length > 0 && (
          <Section title="Upwork Categories">
            {categoryDist.map((c) => (
              <div key={c.category} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{c.category}</span>
                  <span style={{ color: "#888" }}>{c.count}</span>
                </div>
                <BarInline
                  value={Number(c.count)}
                  max={maxCategoryCount}
                  color="#0ea5e9"
                  label="listings"
                />
              </div>
            ))}
          </Section>
        )}
      </div>

      {/* Buyers */}
      <h2 style={{ marginBottom: 8 }}>Buyers ({buyers.length})</h2>
      {buyers.length === 0 ? (
        <p style={{ color: "#888", marginBottom: 24 }}>No buyer data yet.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "2px solid #e5e7eb",
                textAlign: "left",
              }}
            >
              <th style={{ padding: "8px 8px 8px 0" }}>Client</th>
              <th style={{ padding: 8 }}>Company</th>
              <th style={{ padding: 8 }}>Spent</th>
              <th style={{ padding: 8 }}>LTV</th>
              <th style={{ padding: 8 }}>Hire Rate</th>
              <th style={{ padding: 8 }}>Jobs</th>
              <th style={{ padding: 8 }}>Quality</th>
              <th style={{ padding: 8 }}>Size</th>
              <th style={{ padding: 8 }}>Location</th>
              <th style={{ padding: 8 }}>Industry</th>
              <th style={{ padding: 8 }}>Clusters</th>
            </tr>
          </thead>
          <tbody>
            {buyers.map((b) => {
              const ltv = Number(b.total_spent_numeric ?? 0);
              const ltvColor =
                ltv >= 100000
                  ? "#059669"
                  : ltv >= 10000
                  ? "#2563eb"
                  : ltv >= 1000
                  ? "#d97706"
                  : "#9ca3af";
              const isRepeat = Number(b.listings_in_cluster ?? 0) > 1;
              const qualityScore = b.buyer_quality_score != null ? Number(b.buyer_quality_score) : null;
              const qualityColor =
                qualityScore !== null
                  ? qualityScore >= 5000
                    ? "#059669"
                    : qualityScore >= 500
                    ? "#2563eb"
                    : qualityScore >= 50
                    ? "#d97706"
                    : "#9ca3af"
                  : "#9ca3af";
              return (
                <tr key={b.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 8px 8px 0" }}>
                    {b.upwork_profile_url ? (
                      <a
                        href={b.upwork_profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#2563eb", textDecoration: "none" }}
                      >
                        {b.upwork_client_name || "—"}
                      </a>
                    ) : (
                      b.upwork_client_name || "—"
                    )}
                    {isRepeat && (
                      <span
                        style={{
                          marginLeft: 6,
                          background: "#dbeafe",
                          color: "#1d4ed8",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: 4,
                        }}
                      >
                        Repeat ({b.listings_in_cluster})
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 8 }}>{b.company_name || "—"}</td>
                  <td style={{ padding: 8 }}>{b.total_spent || "—"}</td>
                  <td style={{ padding: 8 }}>
                    <span style={{ color: ltvColor, fontWeight: 600 }}>
                      {ltv > 0 ? fmt$(ltv) : "—"}
                    </span>
                  </td>
                  <td style={{ padding: 8 }}>
                    {b.hire_rate != null ? `${b.hire_rate}%` : "—"}
                  </td>
                  <td style={{ padding: 8 }}>
                    {b.jobs_posted != null ? b.jobs_posted : "—"}
                  </td>
                  <td style={{ padding: 8 }}>
                    {qualityScore !== null ? (
                      <span style={{ color: qualityColor, fontWeight: 600 }}>
                        {qualityScore.toLocaleString()}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {b.company_size_indicator || "—"}
                  </td>
                  <td style={{ padding: 8 }}>{b.location || "—"}</td>
                  <td style={{ padding: 8 }}>{b.industry_vertical || "—"}</td>
                  <td style={{ padding: 8 }}>{b.total_clusters ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Listings */}
      <h2 style={{ marginBottom: 8 }}>Listings</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            isOverlap={overlapIds.has(l.id)}
            otherClusterNames={overlapMap.get(l.id)}
            tierColors={tierColors}
            clusterId={selectedClusterId}
            clusters={clusters}
            onFeedback={onFeedback}
            onReassign={onReassign}
          />
        ))}
      </div>
    </div>
  );
}
