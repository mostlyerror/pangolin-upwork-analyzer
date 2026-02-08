"use client";

import { useEffect, useState, useCallback } from "react";

interface RecentRun {
  id: number;
  started_at: string;
  completed_at: string | null;
  listings_total: number;
  listings_succeeded: number;
  listings_failed: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_cents: number;
  status: string;
}

interface QueueStats {
  total: number;
  unprocessed: number;
  processed: number;
  processed_today: number;
  processed_this_week: number;
  errors: number;
  new_clusters_this_week: number;
  existing_cluster_assignments_this_week: number;
  recent_runs: RecentRun[];
  total_cost_cents_this_week: number;
}

interface ProgressItem {
  title: string;
  status: "extracting" | "clustering" | "ok" | "error";
  cluster?: string;
  error?: string;
}

interface RunSummary {
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
  runId: number;
  succeeded: number;
  failed: number;
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function ImportPage() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [batchSize, setBatchSize] = useState(20);
  const [fatalError, setFatalError] = useState<{ errorType: string; message: string } | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function handleImport() {
    setStatus("Importing...");
    try {
      let listings;
      try {
        const parsed = JSON.parse(input);
        listings = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        const lines = input.trim().split("\n");
        listings = [
          {
            title: lines[0],
            description: lines.slice(1).join("\n").trim() || undefined,
          },
        ];
      }

      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listings),
      });

      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const result = await res.json();
      setStatus(
        `Imported ${result.inserted} listing(s), ${result.skipped} duplicate(s) skipped.`
      );
      fetchStats();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  }

  function confirmAndProcess() {
    const count = Math.min(batchSize, stats?.unprocessed ?? 0);
    const calls = count * 2;
    if (!confirm(`Process ${count} listings? This will make ~${calls} Anthropic API calls.`)) return;
    handleProcess();
  }

  async function handleProcess() {
    setProcessing(true);
    setStatus(null);
    setFatalError(null);
    setProgressItems([]);
    setProgressCurrent(0);
    setProgressTotal(0);
    setRunSummary(null);

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: batchSize }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "start") {
              setProgressTotal(data.total);
            } else if (data.type === "progress") {
              setProgressCurrent(data.current);
              setProgressItems((prev) => {
                const existing = prev.findIndex((p) => p.title === data.title);
                const item: ProgressItem = {
                  title: data.title,
                  status: data.step,
                };
                if (existing >= 0) {
                  const next = [...prev];
                  next[existing] = item;
                  return next;
                }
                return [...prev, item];
              });
            } else if (data.type === "item_done") {
              setProgressCurrent(data.current);
              setProgressItems((prev) => {
                const next = [...prev];
                const idx = next.findIndex((p) => p.title === data.title);
                const item: ProgressItem = {
                  title: data.title,
                  status: data.status,
                  cluster: data.cluster,
                  error: data.error,
                };
                if (idx >= 0) {
                  next[idx] = item;
                } else {
                  next.push(item);
                }
                return next;
              });
            } else if (data.type === "fatal_error") {
              setFatalError({ errorType: data.errorType, message: data.message });
              setStatus(`Stopped — ${data.message} (${data.processed} processed, ${data.skipped} skipped)`);
              if (data.inputTokens != null) {
                setRunSummary({
                  inputTokens: data.inputTokens,
                  outputTokens: data.outputTokens,
                  estimatedCostCents: data.estimatedCostCents,
                  runId: data.runId,
                  succeeded: 0,
                  failed: data.processed,
                });
              }
            } else if (data.type === "done") {
              setStatus(`Done — processed ${data.processed} listing(s).`);
              if (data.inputTokens != null) {
                setRunSummary({
                  inputTokens: data.inputTokens,
                  outputTokens: data.outputTokens,
                  estimatedCostCents: data.estimatedCostCents,
                  runId: data.runId,
                  succeeded: data.succeeded ?? data.processed,
                  failed: data.failed ?? 0,
                });
              }
            }
          } catch {}
        }
      }

      fetchStats();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
    setProcessing(false);
  }

  const pct = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Import Listings</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>
        Paste JSON from the Chrome extension, or paste a raw listing (title on
        first line, description below).
      </p>

      {/* Fatal error banner */}
      {fatalError && (
        <div
          style={{
            padding: 14,
            background: fatalError.errorType === "auth_error" ? "#fef2f2" : "#fffbeb",
            border: `1px solid ${fatalError.errorType === "auth_error" ? "#fecaca" : "#fde68a"}`,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: fatalError.errorType === "auth_error" ? "#dc2626" : "#d97706" }}>
            {fatalError.errorType === "auth_error" ? "API Key Error" : "Rate Limited"}
          </div>
          <div style={{ marginBottom: 8 }}>{fatalError.message}</div>
          <a
            href="https://console.anthropic.com/settings/billing"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#2563eb", textDecoration: "underline", fontSize: 13 }}
          >
            Open Anthropic Console
          </a>
        </div>
      )}

      {/* Queue status */}
      {stats && (
        <div
          style={{
            padding: 14,
            background: stats.unprocessed > 0 ? "#fffbeb" : "#f0fdf4",
            border: `1px solid ${stats.unprocessed > 0 ? "#fde68a" : "#bbf7d0"}`,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <strong>{stats.total}</strong> total listings &nbsp;|&nbsp;{" "}
            <strong style={{ color: stats.unprocessed > 0 ? "#d97706" : "#16a34a" }}>
              {stats.unprocessed}
            </strong>{" "}
            awaiting AI processing &nbsp;|&nbsp;{" "}
            <strong style={{ color: "#16a34a" }}>{stats.processed}</strong> processed
          </div>
          {stats.unprocessed > 0 && !processing && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 13, color: "#666" }}>
                Batch:
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                  style={{
                    width: 60, marginLeft: 4, padding: "4px 6px",
                    border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13,
                  }}
                />
              </label>
              <button
                onClick={confirmAndProcess}
                style={{
                  padding: "6px 14px",
                  background: "#059669",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Process {Math.min(batchSize, stats.unprocessed)} of {stats.unprocessed}
              </button>
            </div>
          )}
        </div>
      )}

      {/* AI Processing Stats */}
      {stats && (stats.processed_today > 0 || stats.processed_this_week > 0 || stats.errors > 0) && (
        <div
          style={{
            padding: 14,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>AI Processing Stats</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <span style={{ color: "#64748b" }}>Today:</span>{" "}
              <strong>{stats.processed_today}</strong>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>This week:</span>{" "}
              <strong>{stats.processed_this_week}</strong>
            </div>
            <div>
              <span style={{ color: stats.errors > 0 ? "#dc2626" : "#64748b" }}>Errors:</span>{" "}
              <strong style={{ color: stats.errors > 0 ? "#dc2626" : undefined }}>
                {stats.errors}
              </strong>
              {stats.errors > 0 && (
                <button
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                  style={{
                    marginLeft: 6,
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    cursor: "pointer",
                    fontSize: 12,
                    textDecoration: "underline",
                  }}
                >
                  {showErrorDetails ? "hide" : "details"}
                </button>
              )}
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Clusters this week:</span>{" "}
              <strong>{stats.new_clusters_this_week}</strong> new / <strong>{stats.existing_cluster_assignments_this_week}</strong> existing
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Weekly cost:</span>{" "}
              <strong>{formatCost(stats.total_cost_cents_this_week)}</strong>
            </div>
          </div>
          {showErrorDetails && stats.errors > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 6,
                fontSize: 12,
                color: "#991b1b",
              }}
            >
              {stats.errors} listing(s) failed AI processing. These listings have been marked with errors and will not retry automatically.
              {" "}
              <a
                href="https://console.anthropic.com/settings/billing"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#2563eb", textDecoration: "underline" }}
              >
                Check Anthropic billing
              </a>
            </div>
          )}
        </div>
      )}

      {/* Progress indicator */}
      {processing && progressTotal > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
            <span style={{ fontWeight: 600 }}>
              Processing {progressCurrent} of {progressTotal}
            </span>
            <span style={{ color: "#666" }}>{pct}%</span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: 8,
              background: "#e5e7eb",
              borderRadius: 4,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: "#059669",
                borderRadius: 4,
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {/* Item log */}
          <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 13 }}>
            {progressItems.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: "4px 0",
                  borderBottom: "1px solid #f3f4f6",
                  display: "flex",
                  justifyContent: "space-between",
                  color: item.status === "error" ? "#dc2626" : "#374151",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>
                  {item.title}
                </span>
                <span style={{ color: "#888", fontSize: 12 }}>
                  {item.status === "extracting" && "Extracting..."}
                  {item.status === "clustering" && "Clustering..."}
                  {item.status === "ok" && `→ ${item.cluster}`}
                  {item.status === "error" && `Error: ${item.error}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run summary after processing */}
      {!processing && runSummary && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            fontSize: 13,
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600 }}>Run #{runSummary.runId}</span>
          <span>
            <span style={{ color: "#64748b" }}>Tokens:</span>{" "}
            {formatTokens(runSummary.inputTokens)} in / {formatTokens(runSummary.outputTokens)} out
          </span>
          <span>
            <span style={{ color: "#64748b" }}>Cost:</span>{" "}
            <strong>{formatCost(runSummary.estimatedCostCents)}</strong>
          </span>
          <span>
            <span style={{ color: "#16a34a" }}>{runSummary.succeeded} succeeded</span>
            {runSummary.failed > 0 && (
              <span style={{ color: "#dc2626", marginLeft: 8 }}>{runSummary.failed} failed</span>
            )}
          </span>
        </div>
      )}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={`Paste JSON array from extension, or a raw listing:\n\nBuild a Salesforce-DocuSign integration for real estate\nWe need a developer to connect our Salesforce CRM with DocuSign...`}
        style={{
          width: "100%",
          minHeight: 200,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #d1d5db",
          fontFamily: "monospace",
          fontSize: 13,
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={handleImport}
          disabled={!input.trim()}
          style={{
            padding: "10px 20px",
            background: input.trim() ? "#2563eb" : "#93c5fd",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            cursor: input.trim() ? "pointer" : "not-allowed",
          }}
        >
          Import
        </button>
        <button
          onClick={confirmAndProcess}
          disabled={processing}
          style={{
            padding: "10px 20px",
            background: processing ? "#d1d5db" : "#059669",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            cursor: processing ? "not-allowed" : "pointer",
          }}
        >
          {processing ? "Processing..." : "Run AI Processing"}
        </button>
      </div>

      {status && !processing && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: status.startsWith("Error") || status.startsWith("Stopped") ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${status.startsWith("Error") || status.startsWith("Stopped") ? "#fecaca" : "#bbf7d0"}`,
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {status}
        </div>
      )}

      {/* Recent Runs */}
      {stats && stats.recent_runs && stats.recent_runs.length > 0 && (
        <div
          style={{
            marginTop: 24,
            padding: 14,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Recent Runs</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "6px 10px", color: "#64748b", fontWeight: 500 }}>Date</th>
                  <th style={{ padding: "6px 10px", color: "#64748b", fontWeight: 500 }}>Listings</th>
                  <th style={{ padding: "6px 10px", color: "#64748b", fontWeight: 500 }}>Tokens</th>
                  <th style={{ padding: "6px 10px", color: "#64748b", fontWeight: 500 }}>Est. Cost</th>
                  <th style={{ padding: "6px 10px", color: "#64748b", fontWeight: 500 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_runs.map((run) => (
                  <tr key={run.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>
                      {formatDate(run.started_at)}
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <span style={{ color: "#16a34a" }}>{run.listings_succeeded}</span>
                      {run.listings_failed > 0 && (
                        <span style={{ color: "#dc2626" }}> / {run.listings_failed} failed</span>
                      )}
                    </td>
                    <td style={{ padding: "6px 10px", color: "#64748b" }}>
                      {formatTokens(run.input_tokens)} in / {formatTokens(run.output_tokens)} out
                    </td>
                    <td style={{ padding: "6px 10px", fontWeight: 500 }}>
                      {formatCost(run.estimated_cost_cents)}
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 600,
                          background:
                            run.status === "completed" ? "#dcfce7" :
                            run.status === "running" ? "#dbeafe" : "#fef2f2",
                          color:
                            run.status === "completed" ? "#166534" :
                            run.status === "running" ? "#1e40af" : "#991b1b",
                        }}
                      >
                        {run.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
