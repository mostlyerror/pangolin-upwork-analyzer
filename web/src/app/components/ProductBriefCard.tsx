import { btnStyle } from "./helpers";
import type { ProductBrief } from "./types";

export function ProductBriefCard({
  brief,
  loading,
  onGenerate,
}: {
  brief: ProductBrief | null;
  loading: boolean;
  onGenerate: () => void;
}) {
  // Empty state — just a small button
  if (!brief && !loading) {
    return (
      <button
        onClick={onGenerate}
        style={{
          ...btnStyle("#dcfce7"),
          color: "#166534",
          fontSize: 12,
          marginBottom: 16,
        }}
      >
        Generate Product Brief
      </button>
    );
  }

  // Loading state — skeleton
  if (loading) {
    return (
      <div
        style={{
          padding: 16,
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#166534",
            marginBottom: 8,
          }}
        >
          Generating product brief...
        </div>
        {[90, 75, 60].map((w, i) => (
          <div
            key={i}
            style={{
              height: 14,
              background: "#bbf7d0",
              borderRadius: 4,
              marginBottom: 6,
              animation: "pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
              width: `${w}%`,
            }}
          />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
      </div>
    );
  }

  // Populated state
  return (
    <div
      style={{
        padding: 16,
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
        borderRadius: 8,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>
          Product Brief
        </span>
        <button
          onClick={onGenerate}
          style={{
            ...btnStyle("#dcfce7"),
            color: "#166534",
            fontSize: 11,
            padding: "2px 8px",
          }}
        >
          Regenerate
        </button>
      </div>

      {/* Market summary */}
      <p
        style={{
          fontSize: 14,
          color: "#1a3a2a",
          lineHeight: 1.6,
          margin: "0 0 14px 0",
        }}
      >
        {brief!.market_summary}
      </p>

      {/* Idea cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {brief!.ideas.map((idea, i) => (
          <div
            key={i}
            style={{
              padding: 12,
              background: "white",
              border: "1px solid #bbf7d0",
              borderRadius: 6,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: "#166534",
                marginBottom: 4,
              }}
            >
              {idea.name}
            </div>
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
              <strong>Pain point:</strong> {idea.pain_point}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              <strong>Evidence:</strong> {idea.demand_evidence}
            </div>
            {idea.tools_involved && idea.tools_involved.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  flexWrap: "wrap",
                  marginBottom: 4,
                }}
              >
                {idea.tools_involved.map((tool) => (
                  <span
                    key={tool}
                    style={{
                      background: "#dcfce7",
                      color: "#166534",
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 10,
                      fontWeight: 500,
                    }}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              <strong>Monetization:</strong> {idea.monetization_hint}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
