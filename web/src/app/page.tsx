"use client";

import { useEffect, useState } from "react";

interface Cluster {
  id: number;
  name: string;
  description: string | null;
  heat_score: number;
  listing_count: number;
  avg_budget: number | null;
  velocity: number;
  representative_title?: string;
  recency_factor: number | null;
  listings_this_week: number;
  listings_this_month: number;
  listings_older: number;
  budget_min: number | null;
  budget_max: number | null;
  buyer_count: number;
}

function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + Math.round(Number(n)).toLocaleString();
}

export default function Dashboard() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clusters")
      .then((r) => r.json())
      .then(setClusters)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Opportunity Clusters</h1>
      <p style={{ color: "#666", marginBottom: 4, fontSize: 14 }}>
        Ranked by heat score
      </p>
      <p style={{ color: "#aaa", marginBottom: 24, fontSize: 12 }}>
        Heat = listings x avg budget x recency weight (this week 1.0, this month 0.7, older 0.4)
      </p>

      {loading && <p>Loading...</p>}

      {!loading && clusters.length === 0 && (
        <div style={{
          padding: 40,
          textAlign: "center",
          color: "#888",
          border: "2px dashed #ddd",
          borderRadius: 8,
        }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No clusters yet</p>
          <p>
            <a href="/import">Import some listings</a> to get started.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {clusters.map((c) => (
          <a
            key={c.id}
            href={`/clusters/${c.id}`}
            style={{
              display: "block",
              padding: 16,
              background: "white",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: 4 }}>{c.name}</h3>
                <p style={{ color: "#666", fontSize: 14 }}>{c.description}</p>
              </div>
              <div style={{
                background: "#fef3c7",
                padding: "4px 10px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
                marginLeft: 12,
              }}>
                {Number(c.heat_score).toFixed(0)} heat
              </div>
            </div>

            {/* Formula breakdown */}
            <div style={{
              marginTop: 12,
              padding: 10,
              background: "#f9fafb",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "monospace",
              color: "#555",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}>
              <span style={{ fontWeight: 600 }}>{c.listing_count}</span>
              <span style={{ color: "#aaa" }}>listings</span>
              <span style={{ color: "#ccc" }}>&times;</span>
              <span style={{ fontWeight: 600 }}>{fmt$(c.avg_budget)}</span>
              <span style={{ color: "#aaa" }}>avg budget</span>
              <span style={{ color: "#ccc" }}>&times;</span>
              <span style={{ fontWeight: 600 }}>{Number(c.recency_factor ?? 0).toFixed(2)}</span>
              <span style={{ color: "#aaa" }}>recency</span>
              <span style={{ color: "#ccc" }}>=</span>
              <span style={{ fontWeight: 700, color: "#b45309" }}>{Number(c.heat_score).toFixed(0)}</span>
            </div>

            {/* Detail chips */}
            <div style={{
              display: "flex",
              gap: 8,
              marginTop: 10,
              fontSize: 12,
              flexWrap: "wrap",
            }}>
              <Chip
                label={`${c.listings_this_week} this week`}
                color={c.listings_this_week > 0 ? "#059669" : "#9ca3af"}
              />
              <Chip
                label={`${c.listings_this_month} this month`}
                color={c.listings_this_month > 0 ? "#2563eb" : "#9ca3af"}
              />
              {c.listings_older > 0 && (
                <Chip label={`${c.listings_older} older`} color="#9ca3af" />
              )}
              <Chip
                label={`${fmt$(c.budget_min)} – ${fmt$(c.budget_max)}`}
                color="#7c3aed"
              />
              <Chip
                label={`${c.buyer_count} buyer${c.buyer_count !== 1 ? "s" : ""}`}
                color="#0891b2"
              />
              {Number(c.velocity) > 1 && (
                <Chip
                  label={`${Number(c.velocity).toFixed(1)}x velocity`}
                  color="#dc2626"
                />
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 10,
        border: `1px solid ${color}30`,
        background: `${color}10`,
        color,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
