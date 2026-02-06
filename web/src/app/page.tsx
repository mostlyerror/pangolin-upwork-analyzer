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
      <h1 style={{ marginBottom: 8 }}>Opportunity Clusters</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Ranked by heat score (frequency x budget x recency)
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
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
              }}>
                {Number(c.heat_score).toFixed(0)} heat
              </div>
            </div>
            <div style={{
              display: "flex",
              gap: 16,
              marginTop: 12,
              fontSize: 13,
              color: "#888",
            }}>
              <span>{c.listing_count} listing{c.listing_count !== 1 ? "s" : ""}</span>
              <span>Avg ${c.avg_budget ? Math.round(Number(c.avg_budget)).toLocaleString() : "—"}</span>
              <span>Velocity: {Number(c.velocity).toFixed(1)}x</span>
              {c.representative_title && (
                <span style={{ color: "#aaa" }}>e.g. "{c.representative_title}"</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
