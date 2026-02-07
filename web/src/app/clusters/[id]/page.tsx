"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

export default function ClusterPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Rename state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Merge state
  const [showMerge, setShowMerge] = useState(false);
  const [allClusters, setAllClusters] = useState<ClusterInfo[]>([]);
  const [mergeTarget, setMergeTarget] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    fetch(`/api/clusters/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setEditName(d.cluster.name);
        setEditDesc(d.cluster.description || "");
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRename() {
    const res = await fetch(`/api/clusters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc }),
    });
    if (res.ok) {
      const updated = await res.json();
      setData((prev) => prev ? { ...prev, cluster: updated } : prev);
      setEditing(false);
    }
  }

  async function openMerge() {
    setShowMerge(true);
    const res = await fetch("/api/clusters");
    const clusters = await res.json();
    setAllClusters(clusters.filter((c: ClusterInfo) => c.id !== Number(id)));
  }

  async function handleMerge() {
    if (!mergeTarget) return;
    setMerging(true);
    // Merge the selected cluster INTO this one
    const res = await fetch(`/api/clusters/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merge_from: mergeTarget }),
    });
    if (res.ok) {
      // Reload page data
      const detail = await fetch(`/api/clusters/${id}`).then((r) => r.json());
      setData(detail);
      setShowMerge(false);
      setMergeTarget(null);
    }
    setMerging(false);
  }

  if (loading) return <p>Loading...</p>;
  if (!data) return <p>Cluster not found.</p>;

  const { cluster, listings, buyers } = data;

  return (
    <div>
      <p><a href="/">&larr; All clusters</a></p>

      {/* Header — editable */}
      {editing ? (
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            style={{
              fontSize: 22, fontWeight: 700, width: "100%", padding: "4px 8px",
              border: "1px solid #d1d5db", borderRadius: 6, marginBottom: 8,
            }}
          />
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={2}
            style={{
              width: "100%", padding: "4px 8px", fontSize: 14,
              border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={handleRename} style={btnStyle("#2563eb")}>Save</button>
            <button onClick={() => setEditing(false)} style={btnStyle("#6b7280")}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <h1 style={{ marginBottom: 0 }}>{cluster.name}</h1>
            <button onClick={() => setEditing(true)} style={{ ...btnStyle("#e5e7eb"), color: "#374151", fontSize: 12 }}>
              Rename
            </button>
            <button onClick={openMerge} style={{ ...btnStyle("#e5e7eb"), color: "#374151", fontSize: 12 }}>
              Merge
            </button>
          </div>
          <p style={{ color: "#666", marginBottom: 16, marginTop: 4 }}>{cluster.description}</p>
        </>
      )}

      {/* Merge panel */}
      {showMerge && (
        <div style={{
          padding: 16, background: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: 8, marginBottom: 16,
        }}>
          <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            Merge another cluster into "{cluster.name}"
          </p>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
            All listings from the selected cluster will be moved here. The source cluster will be deleted.
          </p>
          <select
            value={mergeTarget ?? ""}
            onChange={(e) => setMergeTarget(Number(e.target.value) || null)}
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, minWidth: 300 }}
          >
            <option value="">Select a cluster to merge in...</option>
            {allClusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.listing_count} listings, heat {Number(c.heat_score).toFixed(0)})
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
            <button onClick={() => setShowMerge(false)} style={btnStyle("#6b7280")}>Cancel</button>
          </div>
        </div>
      )}

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
          width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: 14,
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
              padding: 14, background: "white", borderRadius: 8, border: "1px solid #e5e7eb",
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

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: "6px 14px",
    background: bg,
    color: "white",
    border: "none",
    borderRadius: 6,
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
  };
}
