import { useMemo } from "react";
import { fmt$ } from "./helpers";
import type { Cluster, StatsData } from "./types";

export function SummaryBar({
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
      {stats && stats.multi_cluster_listings > 0 && (
        <>
          <span style={{ color: "#d1d5db" }}>·</span>
          <span>
            <strong>{stats.multi_cluster_listings}</strong> overlapping
          </span>
        </>
      )}
      {stats && stats.payment_verified_total > 0 && (
        <>
          <span style={{ color: "#d1d5db" }}>·</span>
          <span style={{ color: "#059669" }}>
            <strong>
              {Math.round(
                (stats.payment_verified_count / stats.payment_verified_total) * 100
              )}
              %
            </strong>{" "}
            verified payment
          </span>
        </>
      )}
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
