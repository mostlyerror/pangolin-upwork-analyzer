import { fmt$ } from "./helpers";
import type { VerticalSummary } from "./types";

export function VerticalRow({
  vertical: v,
  selected,
  onClick,
}: {
  vertical: VerticalSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const thisWeek = Number(v.listings_this_week ?? 0);
  const lastWeek = Number(v.listings_last_week ?? 0);
  const wowDelta = thisWeek - lastWeek;
  const growthArrow =
    wowDelta > 0
      ? { symbol: "↑", color: "#059669", label: `+${wowDelta} WoW` }
      : wowDelta < 0
      ? { symbol: "↓", color: "#dc2626", label: `${wowDelta} WoW` }
      : null;

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
          {v.vertical}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#2563eb",
            whiteSpace: "nowrap",
          }}
        >
          {v.listing_count}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#888",
          marginTop: 2,
          display: "flex",
          gap: 4,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span>{v.buyer_count} buyers</span>
        <span>·</span>
        <span>{fmt$(v.avg_budget)} avg</span>
        <span>·</span>
        <span>{v.recurring_count} recurring</span>
        {growthArrow && (
          <>
            <span>·</span>
            <span style={{ color: growthArrow.color, fontWeight: 600 }}>
              {growthArrow.symbol} {growthArrow.label}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
