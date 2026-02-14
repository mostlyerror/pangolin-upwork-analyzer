import { BarInline } from "./BarInline";
import { Section } from "./Section";
import { fmt$ } from "./helpers";
import type { TrendsData, QualityReport } from "./types";

export function TrendsView({
  trends,
  recurringPct,
  quality,
  onClusterClick,
}: {
  trends: TrendsData;
  recurringPct: number;
  quality?: QualityReport | null;
  onClusterClick?: (clusterId: number) => void;
}) {
  const maxVertical = Math.max(
    ...trends.verticals.map((v) => Number(v.count)),
    1
  );
  const maxProblem = Math.max(
    ...trends.problemCategories.map((p) => Number(p.count)),
    1
  );
  const totalBudget =
    trends.budgetTiers.reduce((sum, b) => sum + Number(b.count), 0) || 1;
  const maxVertBudget = Math.max(
    ...trends.verticalBudgets.map((v) => Number(v.total_budget)),
    1
  );
  const rp = trends.recurringProblems;

  // Seasonality
  const maxSeasonality = Math.max(
    ...(trends.seasonality ?? []).map((s) => Number(s.count)),
    1
  );

  // Global geography
  const maxGeoBuyers = Math.max(
    ...(trends.globalGeography ?? []).map((g) => Number(g.buyer_count)),
    1
  );

  // Global tools
  const maxToolCount = Math.max(
    ...(trends.globalTools ?? []).map((t) => Number(t.mention_count)),
    1
  );

  // Global job tiers
  const maxJobTierCount = Math.max(
    ...(trends.globalJobTiers ?? []).map((t) => Number(t.count)),
    1
  );

  // Global durations
  const maxDurationCount = Math.max(
    ...(trends.globalDurations ?? []).map((d) => Number(d.count)),
    1
  );

  // Global categories
  const maxCategoryCount = Math.max(
    ...(trends.globalCategories ?? []).map((c) => Number(c.count)),
    1
  );

  const tierColors: Record<string, string> = {
    Expert: "#7c3aed",
    Intermediate: "#2563eb",
    Entry: "#059669",
  };

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Business Problem Trends</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
        What problems are people paying to solve?
      </p>

      {/* Quality Issues */}
      {quality && (quality.coherence.broadClusters.length > 0 || quality.coherence.catchAllClusters.length > 0 || quality.extractionGaps.totalGaps > 0) && (
        <div
          style={{
            padding: 16,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 10 }}>
            Quality Issues
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
            {quality.coherence.broadClusters.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 4 }}>
                  {quality.coherence.broadClusters.length} broad cluster{quality.coherence.broadClusters.length !== 1 ? "s" : ""} (4+ verticals)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {quality.coherence.broadClusters.map((c) => (
                    <span
                      key={c.id}
                      onClick={() => onClusterClick?.(c.id)}
                      style={{
                        background: "#fef3c7",
                        color: "#78350f",
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 6,
                        cursor: onClusterClick ? "pointer" : "default",
                      }}
                    >
                      {c.name} ({c.distinct_verticals}v)
                    </span>
                  ))}
                </div>
              </div>
            )}
            {quality.coherence.catchAllClusters.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, color: "#991b1b", marginBottom: 4 }}>
                  {quality.coherence.catchAllClusters.length} catch-all cluster{quality.coherence.catchAllClusters.length !== 1 ? "s" : ""}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {quality.coherence.catchAllClusters.map((c) => (
                    <span
                      key={c.id}
                      onClick={() => onClusterClick?.(c.id)}
                      style={{
                        background: "#fee2e2",
                        color: "#991b1b",
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 6,
                        cursor: onClusterClick ? "pointer" : "default",
                      }}
                    >
                      {c.name} ({c.listing_count})
                    </span>
                  ))}
                </div>
              </div>
            )}
            {quality.extractionGaps.missingTools.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 4 }}>
                  {quality.extractionGaps.missingTools.length} listings with unextracted tools
                </div>
                <div style={{ fontSize: 12, color: "#78350f" }}>
                  Tools detected in descriptions but not captured by AI extraction
                </div>
              </div>
            )}
            {quality.extractionGaps.genericVerticals.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 4 }}>
                  {quality.extractionGaps.genericVerticals.length} generic vertical assignments
                </div>
                <div style={{ fontSize: 12, color: "#78350f" }}>
                  Listings with specific skills but vague verticals like &ldquo;Technology&rdquo; or &ldquo;General&rdquo;
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recurring vs one-off callout */}
      {rp && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              padding: 16,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: "#059669" }}>
              {recurringPct}%
            </div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
              recurring problems ({rp.recurring} listings) — avg{" "}
              {fmt$(rp.recurring_avg_budget)}
            </div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              These are problems many businesses share. Stronger product signal.
            </div>
          </div>
          <div
            style={{
              padding: 16,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: "#6b7280" }}>
              {100 - recurringPct}%
            </div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
              one-off problems ({rp.one_off} listings) — avg{" "}
              {fmt$(rp.one_off_avg_budget)}
            </div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              Custom/unique needs. Less likely to be productizable.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Problem categories */}
        <Section title="Top Problem Categories">
          {trends.problemCategories.map((p) => (
            <div key={p.problem_category} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                {p.problem_category}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "#888",
                  marginBottom: 4,
                }}
              >
                <span>
                  avg {fmt$(p.avg_budget)} &middot; {p.buyer_count} buyers
                </span>
                <span>{p.verticals?.slice(0, 2).join(", ")}</span>
              </div>
              <BarInline
                value={Number(p.count)}
                max={maxProblem}
                color="#7c3aed"
                label="listings"
              />
            </div>
          ))}
        </Section>

        {/* Verticals */}
        <Section title="Industries">
          {trends.verticals.map((v) => (
            <div key={v.vertical} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  marginBottom: 2,
                }}
              >
                <span style={{ fontWeight: 500 }}>{v.vertical}</span>
                <span style={{ color: "#888", fontSize: 12 }}>
                  avg {fmt$(v.avg_budget)} &middot; {v.buyer_count} buyers
                </span>
              </div>
              <BarInline
                value={Number(v.count)}
                max={maxVertical}
                color="#2563eb"
                label="listings"
              />
            </div>
          ))}
        </Section>

        {/* Where the money is */}
        <Section title="Where the Money Is">
          <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
            Industries by total budget across all listings
          </p>
          {trends.verticalBudgets.map((v) => (
            <div key={v.vertical} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  marginBottom: 2,
                }}
              >
                <span style={{ fontWeight: 500 }}>{v.vertical}</span>
                <span style={{ color: "#888", fontSize: 12 }}>
                  {fmt$(v.total_budget)} total &middot; {fmt$(v.avg_budget)} avg
                  &middot; {v.count} listings
                </span>
              </div>
              <BarInline
                value={Number(v.total_budget)}
                max={maxVertBudget}
                color="#059669"
                label="total"
              />
            </div>
          ))}
        </Section>

        {/* Budget distribution */}
        <Section title="Budget Distribution">
          {trends.budgetTiers.map((b) => {
            const pct = Math.round((Number(b.count) / totalBudget) * 100);
            const labels: Record<string, string> = {
              high: "High (>$5k)",
              mid: "Mid ($500–$5k)",
              low: "Low (<$500)",
            };
            const colors: Record<string, string> = {
              high: "#059669",
              mid: "#2563eb",
              low: "#9ca3af",
            };
            return (
              <div key={b.budget_tier} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>
                    {labels[b.budget_tier] || b.budget_tier}
                  </span>
                  <span style={{ color: "#888" }}>
                    {b.count} ({pct}%)
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: "#e5e7eb",
                    borderRadius: 4,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: colors[b.budget_tier] || "#888",
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </Section>

        {/* Seasonality */}
        {trends.seasonality && trends.seasonality.length > 0 && (
          <Section title="Seasonality">
            <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
              Monthly listing volume over the last 12 months
            </p>
            {trends.seasonality.map((s) => {
              const label = new Date(s.month).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              });
              return (
                <div key={s.month} style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      marginBottom: 2,
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{label}</span>
                    <span style={{ color: "#888" }}>
                      {s.count} listings &middot; avg {fmt$(s.avg_budget)}
                    </span>
                  </div>
                  <BarInline
                    value={Number(s.count)}
                    max={maxSeasonality}
                    color="#6366f1"
                    label="listings"
                  />
                </div>
              );
            })}
          </Section>
        )}

        {/* Geographic Distribution */}
        {trends.globalGeography && trends.globalGeography.length > 0 && (
          <Section title="Geographic Distribution">
            <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
              Top buyer locations across all listings
            </p>
            {trends.globalGeography.map((g) => (
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
                  <span style={{ color: "#888" }}>
                    {g.buyer_count} buyers &middot; {g.listing_count} listings
                  </span>
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

        {/* Popular Tools */}
        {trends.globalTools && trends.globalTools.length > 0 && (
          <Section title="Popular Tools">
            <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
              Most mentioned tools/technologies across all listings
            </p>
            {trends.globalTools.map((t) => (
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
                  <span style={{ color: "#888" }}>{t.mention_count} mentions</span>
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

        {/* Job Quality Distribution */}
        {trends.globalJobTiers && trends.globalJobTiers.length > 0 && (
          <Section title="Job Quality Distribution">
            <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
              Experience level distribution across all listings
            </p>
            {trends.globalJobTiers.map((t) => (
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
        {trends.globalDurations && trends.globalDurations.length > 0 && (
          <Section title="Engagement Duration">
            <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
              Project length distribution across all listings
            </p>
            {trends.globalDurations.map((d) => (
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
        {trends.globalCategories && trends.globalCategories.length > 0 && (
          <Section title="Upwork Categories">
            <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
              Top categories with average budgets
            </p>
            {trends.globalCategories.map((c) => (
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
                  <span style={{ color: "#888" }}>
                    {c.count}{c.avg_budget ? ` · avg ${fmt$(c.avg_budget)}` : ""}
                  </span>
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

        {/* Market Quality Signals */}
        {(trends.globalPaymentVerification || trends.globalBarrierToEntry) && (
          <Section title="Market Quality Signals">
            {trends.globalPaymentVerification && trends.globalPaymentVerification.verification_rate !== null && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#059669" }}>
                  {trends.globalPaymentVerification.verification_rate}%
                </div>
                <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
                  payment verified ({trends.globalPaymentVerification.verified_count} of{" "}
                  {trends.globalPaymentVerification.total_with_data} with data)
                </div>
              </div>
            )}
            {trends.globalBarrierToEntry && (
              <div>
                {trends.globalBarrierToEntry.avg_connect_price !== null && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>Avg Connect Price</span>
                      <span style={{ fontWeight: 700, color: "#0369a1" }}>
                        {trends.globalBarrierToEntry.avg_connect_price}
                      </span>
                    </div>
                  </div>
                )}
                {Number(trends.globalBarrierToEntry.enterprise_count) > 0 && (
                  <div style={{ marginBottom: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>Enterprise jobs: </span>
                    <span style={{ color: "#7c3aed", fontWeight: 600 }}>
                      {trends.globalBarrierToEntry.enterprise_count}
                    </span>
                  </div>
                )}
                {Number(trends.globalBarrierToEntry.premium_count) > 0 && (
                  <div style={{ marginBottom: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>Premium jobs: </span>
                    <span style={{ color: "#6d28d9", fontWeight: 600 }}>
                      {trends.globalBarrierToEntry.premium_count}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
