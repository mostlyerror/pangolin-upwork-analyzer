"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { selectStyle } from "./components/helpers";
import { fmt$ } from "./components/helpers";
import { SummaryBar } from "./components/SummaryBar";
import { ClusterRow } from "./components/ClusterRow";
import { VerticalRow } from "./components/VerticalRow";
import { SidebarModeToggle } from "./components/SidebarModeToggle";
import { TrendsAccordion } from "./components/TrendsAccordion";
import { TrendsView } from "./components/TrendsView";
import { ClusterDetailView } from "./components/ClusterDetailView";
import { VerticalDetailView } from "./components/VerticalDetailView";
import type {
  Cluster,
  ClusterDetail,
  TrendsData,
  StatsData,
  SortKey,
  SidebarMode,
  VerticalSummary,
  VerticalDetail,
  ProductBrief,
  QualityReport,
} from "./components/types";

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
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Detail state ──
  const [selectedDetail, setSelectedDetail] = useState<ClusterDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Sidebar mode ──
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("clusters");

  // ── Vertical state ──
  const [verticals, setVerticals] = useState<VerticalSummary[]>([]);
  const [selectedVerticalDetail, setSelectedVerticalDetail] = useState<VerticalDetail | null>(null);
  const [verticalDetailLoading, setVerticalDetailLoading] = useState(false);

  // ── Product brief state ──
  const [briefLoading, setBriefLoading] = useState(false);
  const [clusterProductBrief, setClusterProductBrief] = useState<ProductBrief | null>(null);
  const [verticalBriefLoading, setVerticalBriefLoading] = useState(false);
  const [verticalProductBrief, setVerticalProductBrief] = useState<ProductBrief | null>(null);

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
  const [interpretationLoading, setInterpretationLoading] = useState(false);

  // ── Derived ──
  const selectedClusterId = searchParams.get("cluster")
    ? Number(searchParams.get("cluster"))
    : null;
  const selectedVerticalName = searchParams.get("vertical") || null;

  // ── Fetch all data on mount ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [cRes, tRes, sRes, vRes, qRes] = await Promise.all([
      fetch("/api/clusters?limit=100"),
      fetch("/api/trends"),
      fetch("/api/stats"),
      fetch("/api/verticals"),
      fetch("/api/quality"),
    ]);
    const [cData, tData, sData, vData, qData] = await Promise.all([
      cRes.json(),
      tRes.json(),
      sRes.json(),
      vRes.json(),
      qRes.ok ? qRes.json() : null,
    ]);
    setClusters(cData);
    setTrends(tData);
    setStats(sData);
    setVerticals(vData);
    setQuality(qData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Fetch detail when cluster selected ──
  const fetchDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setClusterProductBrief(null);
    const res = await fetch(`/api/clusters/${id}`);
    if (res.ok) {
      const d = await res.json();
      setSelectedDetail(d);
      setEditName(d.cluster.name);
      setEditDesc(d.cluster.description || "");
      setEditing(false);
      setShowMerge(false);
      // Restore cached product brief if available
      if (d.cluster.product_brief) {
        try {
          setClusterProductBrief(JSON.parse(d.cluster.product_brief));
        } catch {
          // ignore malformed cache
        }
      }
    }
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (selectedClusterId) {
      fetchDetail(selectedClusterId);
    } else {
      setSelectedDetail(null);
      setClusterProductBrief(null);
    }
  }, [selectedClusterId, fetchDetail]);

  // ── Fetch vertical detail when vertical selected ──
  const fetchVerticalDetail = useCallback(async (name: string) => {
    setVerticalDetailLoading(true);
    setVerticalProductBrief(null);
    const res = await fetch(`/api/verticals/${encodeURIComponent(name)}`);
    if (res.ok) {
      const d = await res.json();
      setSelectedVerticalDetail(d);
    } else {
      setSelectedVerticalDetail(null);
    }
    setVerticalDetailLoading(false);
  }, []);

  useEffect(() => {
    if (selectedVerticalName) {
      fetchVerticalDetail(selectedVerticalName);
    } else {
      setSelectedVerticalDetail(null);
      setVerticalProductBrief(null);
    }
  }, [selectedVerticalName, fetchVerticalDetail]);

  // ── URL state helpers ──
  function selectCluster(id: number | null) {
    const url = id ? `/?cluster=${id}` : "/";
    router.replace(url, { scroll: false });
  }

  function selectVertical(name: string | null) {
    const url = name ? `/?vertical=${encodeURIComponent(name)}` : "/";
    router.replace(url, { scroll: false });
  }

  function handleSidebarModeChange(mode: SidebarMode) {
    setSidebarMode(mode);
    // Clear the other selection when switching modes
    if (mode === "clusters" && selectedVerticalName) {
      router.replace("/", { scroll: false });
    } else if (mode === "niches" && selectedClusterId) {
      router.replace("/", { scroll: false });
    }
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

  // ── Interpretation handler ──
  async function handleGenerateInterpretation() {
    if (!selectedClusterId) return;
    setInterpretationLoading(true);
    try {
      await fetch(`/api/clusters/${selectedClusterId}/interpret`, { method: "POST" });
      await fetchDetail(selectedClusterId);
    } finally {
      setInterpretationLoading(false);
    }
  }

  // ── Cluster product brief handler ──
  async function handleGenerateClusterBrief() {
    if (!selectedClusterId) return;
    setBriefLoading(true);
    try {
      const res = await fetch(`/api/clusters/${selectedClusterId}/brief`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setClusterProductBrief(data.brief);
      }
    } finally {
      setBriefLoading(false);
    }
  }

  // ── Vertical product brief handler ──
  async function handleGenerateVerticalBrief() {
    if (!selectedVerticalName) return;
    setVerticalBriefLoading(true);
    try {
      const res = await fetch(`/api/verticals/${encodeURIComponent(selectedVerticalName)}/brief`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setVerticalProductBrief(data.brief);
      }
    } finally {
      setVerticalBriefLoading(false);
    }
  }

  // ── Handle clicking a cluster from the vertical detail view ──
  function handleClusterClickFromVertical(clusterId: number) {
    setSidebarMode("clusters");
    router.replace(`/?cluster=${clusterId}`, { scroll: false });
  }

  // ── Quality feedback handler ──
  async function handleFeedback(listingId: number, clusterId: number | null, type: string) {
    await fetch("/api/quality/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: listingId, cluster_id: clusterId, feedback_type: type }),
    });
  }

  // ── Quality reassign handler ──
  async function handleReassign(listingId: number, oldClusterId: number, newClusterId: number) {
    await fetch("/api/quality/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing_id: listingId,
        cluster_id: oldClusterId,
        feedback_type: "reassign_cluster",
        suggested_cluster_id: newClusterId,
      }),
    });
    // Refresh data after reassign
    if (selectedClusterId) await fetchDetail(selectedClusterId);
    await fetchAll();
  }

  // ── Recurring % ──
  const rp = trends?.recurringProblems;
  const recurringTotal = rp ? Number(rp.recurring) + Number(rp.one_off) : 0;
  const recurringPct =
    recurringTotal > 0
      ? Math.round((Number(rp?.recurring) / recurringTotal) * 100)
      : 0;

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;

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
          {/* Mode toggle + Sort/filter controls */}
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              fontSize: 12,
              alignItems: "center",
            }}
          >
            <SidebarModeToggle mode={sidebarMode} onChange={handleSidebarModeChange} />
            {sidebarMode === "clusters" && (
              <>
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
              </>
            )}
          </div>

          {/* List area */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {sidebarMode === "clusters" && (
              <>
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
              </>
            )}

            {sidebarMode === "niches" && (
              <>
                {verticals.length === 0 && (
                  <p style={{ padding: 16, color: "#888", fontSize: 13 }}>
                    No verticals found.
                  </p>
                )}
                {verticals.map((v) => (
                  <VerticalRow
                    key={v.vertical}
                    vertical={v}
                    selected={v.vertical === selectedVerticalName}
                    onClick={() =>
                      selectVertical(
                        v.vertical === selectedVerticalName ? null : v.vertical
                      )
                    }
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div
          style={{ flex: 1, overflowY: "auto", padding: 24 }}
          key={selectedClusterId ?? selectedVerticalName ?? "trends"}
        >
          {/* Default: trends view */}
          {!selectedClusterId && !selectedVerticalName && trends && (
            <TrendsView
              trends={trends}
              recurringPct={recurringPct}
              quality={quality}
              onClusterClick={(id) => {
                setSidebarMode("clusters");
                router.replace(`/?cluster=${id}`, { scroll: false });
              }}
            />
          )}

          {/* Cluster detail */}
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
              onGenerateInterpretation={handleGenerateInterpretation}
              interpretationLoading={interpretationLoading}
              productBrief={clusterProductBrief}
              briefLoading={briefLoading}
              onGenerateBrief={handleGenerateClusterBrief}
              onFeedback={handleFeedback}
              onReassign={handleReassign}
            />
          )}
          {selectedClusterId && !detailLoading && !selectedDetail && (
            <p style={{ color: "#888" }}>Cluster not found.</p>
          )}

          {/* Vertical detail */}
          {selectedVerticalName && verticalDetailLoading && (
            <p style={{ color: "#888" }}>Loading vertical...</p>
          )}
          {selectedVerticalName && !verticalDetailLoading && selectedVerticalDetail && (
            <VerticalDetailView
              detail={selectedVerticalDetail}
              productBrief={verticalProductBrief}
              briefLoading={verticalBriefLoading}
              onGenerateBrief={handleGenerateVerticalBrief}
              onClusterClick={handleClusterClickFromVertical}
              clusters={clusters}
              onFeedback={handleFeedback}
              onReassign={handleReassign}
            />
          )}
          {selectedVerticalName && !verticalDetailLoading && !selectedVerticalDetail && (
            <p style={{ color: "#888" }}>Vertical not found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
