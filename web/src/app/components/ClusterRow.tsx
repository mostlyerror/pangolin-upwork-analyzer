import { fmt$ } from "./helpers";
import type { Cluster } from "./types";

export function ClusterRow({
  cluster: c,
  selected,
  onClick,
}: {
  cluster: Cluster;
  selected: boolean;
  onClick: () => void;
}) {
  // Growth trend: compare this week vs last week
  const thisWeek = Number(c.listings_this_week ?? 0);
  const lastWeek = Number(c.listings_last_week ?? 0);
  const wowDelta = thisWeek - lastWeek;
  const growthArrow =
    wowDelta > 0
      ? { symbol: "↑", color: "#059669", label: `+${wowDelta} WoW` }
      : wowDelta < 0
      ? { symbol: "↓", color: "#dc2626", label: `${wowDelta} WoW` }
      : null;

  // Budget spread: coefficient of variation
  const avg = Number(c.avg_budget ?? 0);
  const stddev = Number(c.budget_stddev ?? 0);
  const cv = avg > 0 ? stddev / avg : 0;
  const spreadLabel = cv > 0.6 ? "wide" : cv > 0 ? "tight" : null;
  const spreadColor = cv > 0.6 ? "#d97706" : "#059669";

  // Staleness: days since last listing
  const latestAt = c.latest_listing_at ? new Date(c.latest_listing_at) : null;
  const daysStale = latestAt
    ? Math.floor((Date.now() - latestAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = daysStale !== null && daysStale > 14;

  // Payment verification rate
  const paymentCount = Number(c.payment_data_count ?? 0);
  const verifiedCount = Number(c.verified_payment_count ?? 0);
  const verifiedPct = paymentCount > 0 ? Math.round((verifiedCount / paymentCount) * 100) : null;

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
      <div style={{ fontSize: 11, color: "#888", marginTop: 2, display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <span>{c.listing_count} listings</span>
        <span>·</span>
        <span>{Number(c.velocity).toFixed(1)}x</span>
        <span>·</span>
        <span>{fmt$(c.avg_budget)} avg</span>
        {growthArrow && (
          <>
            <span>·</span>
            <span style={{ color: growthArrow.color, fontWeight: 600 }}>
              {growthArrow.symbol} {growthArrow.label}
            </span>
          </>
        )}
        {spreadLabel && (
          <>
            <span>·</span>
            <span style={{ color: spreadColor, fontWeight: 500 }}>
              {spreadLabel}
            </span>
          </>
        )}
        {isStale && (
          <>
            <span>·</span>
            <span style={{ color: "#dc2626", fontWeight: 600 }}>
              stale ({daysStale}d)
            </span>
          </>
        )}
        {verifiedPct !== null && (
          <>
            <span>·</span>
            <span style={{ color: "#059669", fontWeight: 500 }}>
              {verifiedPct}% verified
            </span>
          </>
        )}
      </div>
    </div>
  );
}
