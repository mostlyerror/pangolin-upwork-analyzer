"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Cluster {
  id: number;
  name: string;
  description: string | null;
  heat_score: number;
  listing_count: number;
  avg_budget: number | null;
  velocity: number;
  representative_title?: string;
  top_verticals?: string[];
  recency_factor: number | null;
  listings_this_week: number;
  listings_this_month: number;
  listings_older: number;
  budget_min: number | null;
  budget_max: number | null;
  buyer_count: number;
}

interface Listing {
  id: number;
  title: string;
  description: string | null;
  upwork_url: string | null;
  budget_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  problem_category: string | null;
  vertical: string | null;
  tools_mentioned: string[] | null;
  captured_at: string;
}

interface Buyer {
  id: number;
  upwork_client_name: string | null;
  company_name: string | null;
  total_spent: string | null;
  location: string | null;
  industry_vertical: string | null;
}

interface ClusterInfo {
  id: number;
  name: string;
  description: string | null;
  heat_score: number;
  listing_count: number;
  avg_budget: number | null;
  velocity: number;
}

interface ClusterDetail {
  cluster: ClusterInfo;
  listings: Listing[];
  buyers: Buyer[];
}

interface Vertical {
  vertical: string;
  count: string;
  avg_budget: string;
  buyer_count: string;
  total_budget: string;
}

interface ProblemCategory {
  problem_category: string;
  count: string;
  avg_budget: string;
  buyer_count: string;
  verticals: string[];
}

interface RecurringProblems {
  recurring: string;
  one_off: string;
  recurring_avg_budget: string;
  one_off_avg_budget: string;
}

interface BudgetTier {
  budget_tier: string;
  count: string;
}

interface VerticalBudget {
  vertical: string;
  avg_budget: string;
  total_budget: string;
  count: string;
}

interface TrendsData {
  verticals: Vertical[];
  problemCategories: ProblemCategory[];
  recurringProblems: RecurringProblems | null;
  budgetTiers: BudgetTier[];
  verticalBudgets: VerticalBudget[];
}

interface StatsData {
  total: number;
  unprocessed: number;
  processed: number;
}

type SortKey = "heat_score" | "velocity" | "listing_count" | "avg_budget";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt$(n: string | number | null | undefined) {
  if (n == null) return "—";
  return "$" + Math.round(Number(n)).toLocaleString();
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: "6px 14px",
    background: bg,
    color: "white",
    border: "none",
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 13,
  };
}

// ─── Main page wrapped in Suspense ──────────────────────────────────────────

export default function DiscoverPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading...</p>}>
      <DiscoverInner />
    </Suspense>
  );
}

function DiscoverInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── Data state ──
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Detail state ──
  const [selectedDetail, setSelectedDetail] = useState<ClusterDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── UI controls ──
  const [sortBy, setSortBy] = useState<SortKey>("heat_score");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [filterVertical, setFilterVertical] = useState<string | null>(null);
  const [filterBudgetTier, setFilterBudgetTier] = useState<string | null>(null);
  const [trendsExpanded, setTrendsExpanded] = useState<Record<string, boolean>>({});

  // ── Rename/merge state ──
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [showMerge, setShowMerge] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);

  // ── Derived ──
  const selectedClusterId = searchParams.get("cluster")
    ? Number(searchParams.get("cluster"))
    : null;

  // ── Fetch all data on mount ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [cRes, tRes, sRes] = await Promise.all([
      fetch("/api/clusters?limit=100"),
      fetch("/api/trends"),
      fetch("/api/stats"),
    ]);
    const [cData, tData, sData] = await Promise.all([
      cRes.json(),
      tRes.json(),
      sRes.json(),
    ]);
    setClusters(cData);
    setTrends(tData);
    setStats(sData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Fetch detail when cluster selected ──
  const fetchDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    const res = await fetch(`/api/clusters/${id}`);
    if (res.ok) {
      const d = await res.json();
      setSelectedDetail(d);
      setEditName(d.cluster.name);
      setEditDesc(d.cluster.description || "");
      setEditing(false);
      setShowMerge(false);
    }
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (selectedClusterId) {
      fetchDetail(selectedClusterId);
    } else {
      setSelectedDetail(null);
    }
  }, [selectedClusterId, fetchDetail]);

  // ── URL state helpers ──
  function selectCluster(id: number | null) {
    const url = id ? `/?cluster=${id}` : "/";
    router.replace(url, { scroll: false });
  }

  // ── Sort/filter (client-side) ──
  const allVerticals = useMemo(() => {
    if (!trends) return [];
    return trends.verticals.map((v) => v.vertical);
  }, [trends]);

  const filteredClusters = useMemo(() => {
    let list = [...clusters];

    if (filterVertical) {
      list = list.filter((c) => c.top_verticals?.includes(filterVertical));
    }
    if (filterBudgetTier) {
      list = list.filter((c) => {
        const avg = Number(c.avg_budget ?? 0);
        if (filterBudgetTier === "high") return avg > 5000;
        if (filterBudgetTier === "mid") return avg >= 500 && avg <= 5000;
        if (filterBudgetTier === "low") return avg < 500;
        return true;
      });
    }

    list.sort((a, b) => {
      const av = Number(a[sortBy] ?? 0);
      const bv = Number(b[sortBy] ?? 0);
      return sortDir === "desc" ? bv - av : av - bv;
    });

    return list;
  }, [clusters, sortBy, sortDir, filterVertical, filterBudgetTier]);

  // ── Rename handler ──
  async function handleRename() {
    if (!selectedClusterId) return;
    const res = await fetch(`/api/clusters/${selectedClusterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc }),
    });
    if (res.ok) {
      setEditing(false);
      // Refresh both sidebar and detail
      await Promise.all([fetchAll(), fetchDetail(selectedClusterId)]);
    }
  }

  // ── Merge handler ──
  async function handleMerge() {
    if (!mergeTarget || !selectedClusterId) return;
    setMerging(true);
    const res = await fetch(`/api/clusters/${selectedClusterId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merge_from: mergeTarget }),
    });
    if (res.ok) {
      setShowMerge(false);
      setMergeTarget(null);
      await Promise.all([fetchAll(), fetchDetail(selectedClusterId)]);
    }
    setMerging(false);
  }

  // ── Recurring % ──
  const rp = trends?.recurringProblems;
  const recurringTotal = rp ? Number(rp.recurring) + Number(rp.one_off) : 0;
  const recurringPct =
    recurringTotal > 0
      ? Math.round((Number(rp?.recurring) / recurringTotal) * 100)
      : 0;

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 49px)" }}>
      {/* ── Summary Bar ── */}
      <SummaryBar stats={stats} clusters={clusters} recurringPct={recurringPct} />

      {/* ── Main Layout ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── LEFT SIDEBAR ── */}
        <div
          style={{
            width: 350,
            minWidth: 350,
            borderRight: "1px solid #e5e7eb",
            background: "white",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Sort/filter controls */}
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              fontSize: 12,
            }}
          >
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              style={selectStyle}
            >
              <option value="heat_score">Heat</option>
              <option value="velocity">Velocity</option>
              <option value="listing_count">Listings</option>
              <option value="avg_budget">Budget</option>
            </select>
            <button
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              style={{
                ...selectStyle,
                background: "#f3f4f6",
                border: "1px solid #d1d5db",
                fontSize: 12,
              }}
            >
              {sortDir === "desc" ? "↓" : "↑"}
            </button>
            <select
              value={filterVertical ?? ""}
              onChange={(e) => setFilterVertical(e.target.value || null)}
              style={selectStyle}
            >
              <option value="">All verticals</option>
              {allVerticals.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select
              value={filterBudgetTier ?? ""}
              onChange={(e) => setFilterBudgetTier(e.target.value || null)}
              style={selectStyle}
            >
              <option value="">All budgets</option>
              <option value="high">High (&gt;$5k)</option>
              <option value="mid">Mid ($500-$5k)</option>
              <option value="low">Low (&lt;$500)</option>
            </select>
          </div>

          {/* Cluster list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredClusters.length === 0 && (
              <p style={{ padding: 16, color: "#888", fontSize: 13 }}>
                No clusters match filters.
              </p>
            )}
            {filteredClusters.map((c) => (
              <ClusterRow
                key={c.id}
                cluster={c}
                selected={c.id === selectedClusterId}
                onClick={() => selectCluster(c.id === selectedClusterId ? null : c.id)}
              />
            ))}

            {/* Trend accordions */}
            {trends && (
              <div style={{ borderTop: "1px solid #e5e7eb" }}>
                <TrendsAccordion
                  title="Top Verticals"
                  id="verticals"
                  expanded={trendsExpanded}
                  setExpanded={setTrendsExpanded}
                >
                  {trends.verticals.slice(0, 3).map((v) => (
                    <div
                      key={v.vertical}
                      style={{
                        padding: "4px 0",
                        fontSize: 12,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{v.vertical}</span>
                      <span style={{ color: "#888" }}>
                        {v.count} · {fmt$(v.avg_budget)}
                      </span>
                    </div>
                  ))}
                </TrendsAccordion>
                <TrendsAccordion
                  title="Budget Distribution"
                  id="budget"
                  expanded={trendsExpanded}
                  setExpanded={setTrendsExpanded}
                >
                  {trends.budgetTiers.map((b) => {
                    const total = trends.budgetTiers.reduce(
                      (s, t) => s + Number(t.count),
                      0
                    );
                    const pct =
                      total > 0 ? Math.round((Number(b.count) / total) * 100) : 0;
                    const labels: Record<string, string> = {
                      high: "High (>$5k)",
                      mid: "Mid ($500-$5k)",
                      low: "Low (<$500)",
                    };
                    return (
                      <div
                        key={b.budget_tier}
                        style={{
                          padding: "4px 0",
                          fontSize: 12,
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{labels[b.budget_tier] || b.budget_tier}</span>
                        <span style={{ color: "#888" }}>
                          {b.count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </TrendsAccordion>
                <TrendsAccordion
                  title="Recurring vs One-Off"
                  id="recurring"
                  expanded={trendsExpanded}
                  setExpanded={setTrendsExpanded}
                >
                  {rp && (
                    <div style={{ fontSize: 12 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "4px 0",
                        }}
                      >
                        <span style={{ color: "#059669", fontWeight: 600 }}>
                          {recurringPct}% recurring
                        </span>
                        <span style={{ color: "#888" }}>
                          {rp.recurring} · avg {fmt$(rp.recurring_avg_budget)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "4px 0",
                        }}
                      >
                        <span>{100 - recurringPct}% one-off</span>
                        <span style={{ color: "#888" }}>
                          {rp.one_off} · avg {fmt$(rp.one_off_avg_budget)}
                        </span>
                      </div>
                    </div>
                  )}
                </TrendsAccordion>
                <TrendsAccordion
                  title="Where the Money Is"
                  id="money"
                  expanded={trendsExpanded}
                  setExpanded={setTrendsExpanded}
                >
                  {trends.verticalBudgets.slice(0, 3).map((v) => (
                    <div
                      key={v.vertical}
                      style={{
                        padding: "4px 0",
                        fontSize: 12,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{v.vertical}</span>
                      <span style={{ color: "#888" }}>
                        {fmt$(v.total_budget)} total
                      </span>
                    </div>
                  ))}
                </TrendsAccordion>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }} key={selectedClusterId ?? "trends"}>
          {!selectedClusterId && trends && (
            <TrendsView trends={trends} recurringPct={recurringPct} />
          )}
          {selectedClusterId && detailLoading && (
            <p style={{ color: "#888" }}>Loading cluster...</p>
          )}
          {selectedClusterId && !detailLoading && selectedDetail && (
            <ClusterDetailView
              detail={selectedDetail}
              clusters={clusters}
              selectedClusterId={selectedClusterId}
              editing={editing}
              setEditing={setEditing}
              editName={editName}
              setEditName={setEditName}
              editDesc={editDesc}
              setEditDesc={setEditDesc}
              handleRename={handleRename}
              showMerge={showMerge}
              setShowMerge={setShowMerge}
              mergeTarget={mergeTarget}
              setMergeTarget={setMergeTarget}
              merging={merging}
              handleMerge={handleMerge}
            />
          )}
          {selectedClusterId && !detailLoading && !selectedDetail && (
            <p style={{ color: "#888" }}>Cluster not found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: "4px 6px",
  borderRadius: 4,
  border: "1px solid #d1d5db",
  fontSize: 12,
  background: "white",
};

// ─── SummaryBar ─────────────────────────────────────────────────────────────

function SummaryBar({
  stats,
  clusters,
  recurringPct,
}: {
  stats: StatsData | null;
  clusters: Cluster[];
  recurringPct: number;
}) {
  const avgBudget = useMemo(() => {
    const withBudget = clusters.filter((c) => c.avg_budget != null);
    if (withBudget.length === 0) return null;
    return (
      withBudget.reduce((s, c) => s + Number(c.avg_budget), 0) / withBudget.length
    );
  }, [clusters]);

  return (
    <div
      style={{
        padding: "8px 24px",
        borderBottom: "1px solid #e5e7eb",
        background: "white",
        display: "flex",
        gap: 20,
        fontSize: 13,
        color: "#374151",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <span>
        <strong>{stats?.total ?? 0}</strong> listings
      </span>
      <span style={{ color: "#d1d5db" }}>·</span>
      <span>
        <strong>{clusters.length}</strong> clusters
      </span>
      <span style={{ color: "#d1d5db" }}>·</span>
      <span>
        <strong>{recurringPct}%</strong> recurring
      </span>
      <span style={{ color: "#d1d5db" }}>·</span>
      <span>
        <strong>{fmt$(avgBudget)}</strong> avg budget
      </span>
      {stats && stats.unprocessed > 0 && (
        <>
          <span style={{ color: "#d1d5db" }}>·</span>
          <a href="/import" style={{ color: "#d97706", fontWeight: 600, fontSize: 13 }}>
            {stats.unprocessed} unprocessed
          </a>
        </>
      )}
    </div>
  );
}

// ─── ClusterRow ─────────────────────────────────────────────────────────────

function ClusterRow({
  cluster: c,
  selected,
  onClick,
}: {
  cluster: Cluster;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderBottom: "1px solid #f3f4f6",
        borderLeft: selected ? "3px solid #2563eb" : "3px solid transparent",
        background: selected ? "#eff6ff" : "white",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "#f9fafb";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "white";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            marginRight: 8,
          }}
        >
          {c.name}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#b45309",
            whiteSpace: "nowrap",
          }}
        >
          {Number(c.heat_score).toFixed(0)}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
        {c.listing_count} listings · {Number(c.velocity).toFixed(1)}x ·{" "}
        {fmt$(c.avg_budget)} avg
      </div>
    </div>
  );
}

// ─── TrendsAccordion ────────────────────────────────────────────────────────

function TrendsAccordion({
  title,
  id,
  expanded,
  setExpanded,
  children,
}: {
  title: string;
  id: string;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  children: React.ReactNode;
}) {
  const isOpen = !!expanded[id];
  return (
    <div style={{ borderBottom: "1px solid #f3f4f6" }}>
      <div
        onClick={() => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))}
        style={{
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 600,
          color: "#374151",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f9fafb",
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10, color: "#999" }}>{isOpen ? "▾" : "▸"}</span>
      </div>
      {isOpen && <div style={{ padding: "6px 12px 10px" }}>{children}</div>}
    </div>
  );
}

// ─── TrendsView (right panel, full) ─────────────────────────────────────────

function BarInline({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3 }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
          }}
        />
      </div>
      <span
        style={{ fontSize: 12, color: "#666", minWidth: 24, textAlign: "right" }}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h2 style={{ fontSize: 15, marginBottom: 12, color: "#374151" }}>{title}</h2>
      {children}
    </div>
  );
}

function TrendsView({
  trends,
  recurringPct,
}: {
  trends: TrendsData;
  recurringPct: number;
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
  const recurringTotal = rp ? Number(rp.recurring) + Number(rp.one_off) : 0;

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Business Problem Trends</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
        What problems are people paying to solve?
      </p>

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
      </div>
    </div>
  );
}

// ─── ClusterDetailView (right panel) ────────────────────────────────────────

function ClusterDetailView({
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
}) {
  const { cluster, listings, buyers } = detail;
  const otherClusters = clusters.filter((c) => c.id !== selectedClusterId);

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
          <p style={{ color: "#666", marginBottom: 16, marginTop: 4 }}>
            {cluster.description}
          </p>
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

      {/* Metrics row */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 24,
          fontSize: 14,
          color: "#666",
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
              <th style={{ padding: 8 }}>Location</th>
              <th style={{ padding: 8 }}>Industry</th>
            </tr>
          </thead>
          <tbody>
            {buyers.map((b) => (
              <tr key={b.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px 8px 8px 0" }}>
                  {b.upwork_client_name || "—"}
                </td>
                <td style={{ padding: 8 }}>{b.company_name || "—"}</td>
                <td style={{ padding: 8 }}>{b.total_spent || "—"}</td>
                <td style={{ padding: 8 }}>{b.location || "—"}</td>
                <td style={{ padding: 8 }}>{b.industry_vertical || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Listings */}
      <h2 style={{ marginBottom: 8 }}>Listings</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {listings.map((l) => (
          <div
            key={l.id}
            style={{
              padding: 14,
              background: "white",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <strong>{l.title}</strong>
              {l.budget_min != null && (
                <span style={{ color: "#666", fontSize: 13 }}>
                  ${Number(l.budget_min).toLocaleString()}
                  {l.budget_max && l.budget_max !== l.budget_min
                    ? ` - $${Number(l.budget_max).toLocaleString()}`
                    : ""}
                  {l.budget_type === "hourly" ? "/hr" : ""}
                </span>
              )}
            </div>
            {l.description && (
              <p style={{ color: "#555", fontSize: 13, marginTop: 6 }}>
                {l.description.length > 200
                  ? l.description.slice(0, 200) + "..."
                  : l.description}
              </p>
            )}
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 12,
                fontSize: 12,
                color: "#999",
              }}
            >
              {l.vertical && <span>{l.vertical}</span>}
              {l.tools_mentioned && l.tools_mentioned.length > 0 && (
                <span>Tools: {l.tools_mentioned.join(", ")}</span>
              )}
              {l.upwork_url && (
                <a
                  href={l.upwork_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on Upwork
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
