"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

interface ClusterDetail {
  cluster: {
    id: number;
    name: string;
    description: string | null;
    heat_score: number;
    listing_count: number;
    avg_budget: number | null;
    velocity: number;
  };
  listings: Listing[];
  buyers: Buyer[];
}

export default function ClusterPage() {
  const { id } = useParams();
  const [data, setData] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clusters/${id}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (!data) return <p>Cluster not found.</p>;

  const { cluster, listings, buyers } = data;

  return (
    <div>
      <p><a href="/">&larr; All clusters</a></p>
      <h1 style={{ marginTop: 8, marginBottom: 4 }}>{cluster.name}</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>{cluster.description}</p>

      <div style={{ display: "flex", gap: 16, marginBottom: 24, fontSize: 14, color: "#666" }}>
        <span>Heat: <strong>{Number(cluster.heat_score).toFixed(0)}</strong></span>
        <span>{cluster.listing_count} listings</span>
        <span>Avg budget: ${cluster.avg_budget ? Math.round(Number(cluster.avg_budget)).toLocaleString() : "—"}</span>
        <span>Velocity: {Number(cluster.velocity).toFixed(1)}x</span>
      </div>

      {/* Buyers */}
      <h2 style={{ marginBottom: 8 }}>Buyers ({buyers.length})</h2>
      {buyers.length === 0 ? (
        <p style={{ color: "#888", marginBottom: 24 }}>No buyer data yet.</p>
      ) : (
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: 24,
          fontSize: 14,
        }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
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
                <td style={{ padding: "8px 8px 8px 0" }}>{b.upwork_client_name || "—"}</td>
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
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{l.title}</strong>
              {l.budget_min != null && (
                <span style={{ color: "#666", fontSize: 13 }}>
                  ${Number(l.budget_min).toLocaleString()}
                  {l.budget_max && l.budget_max !== l.budget_min ? ` - $${Number(l.budget_max).toLocaleString()}` : ""}
                  {l.budget_type === "hourly" ? "/hr" : ""}
                </span>
              )}
            </div>
            {l.description && (
              <p style={{ color: "#555", fontSize: 13, marginTop: 6 }}>
                {l.description.length > 200 ? l.description.slice(0, 200) + "..." : l.description}
              </p>
            )}
            <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 12, color: "#999" }}>
              {l.vertical && <span>{l.vertical}</span>}
              {l.tools_mentioned && l.tools_mentioned.length > 0 && (
                <span>Tools: {l.tools_mentioned.join(", ")}</span>
              )}
              {l.upwork_url && (
                <a href={l.upwork_url} target="_blank" rel="noopener noreferrer">View on Upwork</a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
