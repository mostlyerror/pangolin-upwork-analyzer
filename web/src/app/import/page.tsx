"use client";

import { useEffect, useState, useCallback } from "react";

interface QueueStats {
  total: number;
  unprocessed: number;
  processed: number;
  processed_today: number;
  processed_this_week: number;
  errors: number;
  new_clusters_this_week: number;
  existing_cluster_assignments_this_week: number;
}

interface ProgressItem {
  title: string;
  status: "extracting" | "clustering" | "ok" | "error";
  cluster?: string;
  error?: string;
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
            } else if (data.type === "done") {
              setStatus(`Done — processed ${data.processed} listing(s).`);
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
    </div>
  );
}
