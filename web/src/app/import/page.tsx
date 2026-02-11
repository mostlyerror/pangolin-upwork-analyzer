"use client";

import { useEffect, useState, useCallback, useRef } from "react";

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

interface ExtractionItem {
  id: number;
  title: string;
  problem_category?: string;
  vertical?: string;
  workflow_described?: string;
  tools_mentioned?: string[];
  budget_tier?: string;
  is_recurring_type_need?: boolean;
  status?: "ok" | "error";
  error?: string;
}

interface ClusterProgressItem {
  title: string;
  status: "clustering" | "ok" | "error";
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

type Phase = "idle" | "extracting" | "reviewing" | "clustering" | "done";

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

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function ImportPage() {
  const [input, setInput] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [batchSize, setBatchSize] = useState(20);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Phase state machine
  const [phase, setPhase] = useState<Phase>("idle");

  // Extraction state
  const [extractionResults, setExtractionResults] = useState<ExtractionItem[]>([]);
  const [extractionCostCents, setExtractionCostCents] = useState(0);
  const [extractionTokens, setExtractionTokens] = useState({ input: 0, output: 0 });
  const [extractionRunId, setExtractionRunId] = useState<number | null>(null);
  const [extractBatchProgress, setExtractBatchProgress] = useState({ current: 0, total: 0 });

  // Review state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Clustering state
  const [clusterProgressItems, setClusterProgressItems] = useState<ClusterProgressItem[]>([]);
  const [clusterProgress, setClusterProgress] = useState({ current: 0, total: 0 });
  const [clusterCostCents, setClusterCostCents] = useState(0);
  const [clusterTokens, setClusterTokens] = useState({ input: 0, output: 0 });
  const [clusterRunId, setClusterRunId] = useState<number | null>(null);

  // Done state — combined summaries
  const [extractionSummary, setExtractionSummary] = useState<RunSummary | null>(null);
  const [clusterSummary, setClusterSummary] = useState<RunSummary | null>(null);

  // Shared
  const [fatalError, setFatalError] = useState<{ errorType: string; message: string } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [costSoFar, setCostSoFar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const elapsedStart = useRef<number>(0);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Elapsed timer
  useEffect(() => {
    if (phase === "extracting" || phase === "clustering") {
      elapsedStart.current = Date.now();
      setElapsedMs(0);
      const interval = setInterval(() => {
        setElapsedMs(Date.now() - elapsedStart.current);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase]);

  async function handleImport() {
    setImportStatus("Importing...");
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
      setImportStatus(
        `Imported ${result.inserted} listing(s), ${result.skipped} duplicate(s) skipped.`
      );
      fetchStats();
    } catch (err: any) {
      setImportStatus(`Error: ${err.message}`);
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  async function handleExtract() {
    const count = Math.min(batchSize, stats?.unprocessed ?? 0);
    if (!confirm(`Extract ${count} listings? This will make batched Haiku API calls.`)) return;

    setPhase("extracting");
    setFatalError(null);
    setExtractionResults([]);
    setExtractionCostCents(0);
    setExtractionTokens({ input: 0, output: 0 });
    setExtractionRunId(null);
    setExtractBatchProgress({ current: 0, total: 0 });
    setCostSoFar(0);
    setExtractionSummary(null);
    setClusterSummary(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/process/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: batchSize }),
        signal: controller.signal,
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
              setExtractBatchProgress((p) => ({ ...p, total: data.total }));
            } else if (data.type === "batch_start") {
              // batch starting
            } else if (data.type === "batch_done") {
              // Update running totals
              const items: ExtractionItem[] = (data.items || []).map((item: any) => ({
                id: item.id,
                title: item.title,
                status: item.status,
                error: item.error,
                ...(item.extraction || {}),
              }));
              setExtractionResults((prev) => [...prev, ...items]);
              setExtractBatchProgress((p) => ({
                ...p,
                current: p.current + (data.items?.length || 0),
              }));
              setCostSoFar(data.costSoFarCents || 0);
            } else if (data.type === "fatal_error") {
              setFatalError({ errorType: data.errorType, message: data.message });
            } else if (data.type === "done") {
              setExtractionTokens({ input: data.tokens?.input || 0, output: data.tokens?.output || 0 });
              setExtractionCostCents(data.costCents || 0);
              setExtractionRunId(data.runId || null);

              // If we got results from the done event, use them as fallback
              if (data.results && data.results.length > 0) {
                setExtractionResults((prev) => {
                  if (prev.length > 0) return prev;
                  return data.results.map((r: any) => ({
                    id: r.id,
                    title: r.title,
                    status: r.status || "ok",
                    error: r.error,
                    problem_category: r.problem_category,
                    vertical: r.vertical,
                    workflow_described: r.workflow_described,
                    tools_mentioned: r.tools_mentioned,
                    budget_tier: r.budget_tier,
                    is_recurring_type_need: r.is_recurring_type_need,
                  }));
                });
              }

              const summary: RunSummary = {
                inputTokens: data.tokens?.input || 0,
                outputTokens: data.tokens?.output || 0,
                estimatedCostCents: data.costCents || 0,
                runId: data.runId || 0,
                succeeded: data.succeeded || 0,
                failed: data.failed || 0,
              };
              setExtractionSummary(summary);

              // Move to review phase — set selectedIds to all successful
              setExtractionResults((prev) => {
                const successIds = new Set(prev.filter((r) => r.status === "ok").map((r) => r.id));
                setSelectedIds(successIds);
                return prev;
              });
              setPhase("reviewing");
              fetchStats();
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User cancelled — go to reviewing with whatever we have
        setExtractionResults((prev) => {
          const successIds = new Set(prev.filter((r) => r.status === "ok").map((r) => r.id));
          setSelectedIds(successIds);
          return prev;
        });
        setPhase("reviewing");
        fetchStats();
      } else {
        setFatalError({ errorType: "connection_error", message: err.message });
        setPhase("idle");
      }
    }
    abortControllerRef.current = null;
  }

  async function handleCluster() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setPhase("clustering");
    setClusterProgressItems([]);
    setClusterProgress({ current: 0, total: ids.length });
    setClusterCostCents(0);
    setClusterTokens({ input: 0, output: 0 });
    setClusterRunId(null);
    setCostSoFar(0);
    setClusterSummary(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/process/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: ids }),
        signal: controller.signal,
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
              setClusterProgress((p) => ({ ...p, total: data.total }));
            } else if (data.type === "progress") {
              setClusterProgress((p) => ({ ...p, current: data.current }));
              setClusterProgressItems((prev) => {
                const existing = prev.findIndex((p) => p.title === data.title);
                const item: ClusterProgressItem = { title: data.title, status: "clustering" };
                if (existing >= 0) {
                  const next = [...prev];
                  next[existing] = item;
                  return next;
                }
                return [...prev, item];
              });
            } else if (data.type === "item_done") {
              setClusterProgress((p) => ({ ...p, current: data.current }));
              setClusterProgressItems((prev) => {
                const next = [...prev];
                const idx = next.findIndex((p) => p.title === data.title);
                const item: ClusterProgressItem = {
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
            } else if (data.type === "done") {
              setClusterTokens({ input: data.tokens?.input || 0, output: data.tokens?.output || 0 });
              setClusterCostCents(data.costCents || 0);
              setClusterRunId(data.runId || null);

              const summary: RunSummary = {
                inputTokens: data.tokens?.input || 0,
                outputTokens: data.tokens?.output || 0,
                estimatedCostCents: data.costCents || 0,
                runId: data.runId || 0,
                succeeded: data.succeeded || 0,
                failed: data.failed || 0,
              };
              setClusterSummary(summary);
              setPhase("done");
              fetchStats();
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setPhase("done");
        fetchStats();
      } else {
        setFatalError({ errorType: "connection_error", message: err.message });
        setPhase("done");
      }
    }
    abortControllerRef.current = null;
  }

  function handleSkipClustering() {
    setPhase("done");
  }

  function handleReset() {
    setPhase("idle");
    setExtractionResults([]);
    setSelectedIds(new Set());
    setClusterProgressItems([]);
    setFatalError(null);
    setExtractionSummary(null);
    setClusterSummary(null);
    setCostSoFar(0);
    setElapsedMs(0);
    fetchStats();
  }

  function toggleSelectAll() {
    const successIds = extractionResults.filter((r) => r.status === "ok").map((r) => r.id);
    if (selectedIds.size === successIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(successIds));
    }
  }

  function toggleItem(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isActive = phase === "extracting" || phase === "clustering";
  const extractPct = extractBatchProgress.total > 0 ? Math.round((extractBatchProgress.current / extractBatchProgress.total) * 100) : 0;
  const clusterPct = clusterProgress.total > 0 ? Math.round((clusterProgress.current / clusterProgress.total) * 100) : 0;
  const successCount = extractionResults.filter((r) => r.status === "ok").length;
  const errorCount = extractionResults.filter((r) => r.status === "error").length;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
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
            {fatalError.errorType === "auth_error" ? "API Key Error" : fatalError.errorType === "rate_limit" ? "Rate Limited" : "Error"}
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
          {stats.unprocessed > 0 && phase === "idle" && (
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
                onClick={handleExtract}
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
                Extract {Math.min(batchSize, stats.unprocessed)} Listings
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

      {/* =================== EXTRACTING PHASE =================== */}
      {phase === "extracting" && (
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
              Extracting {extractBatchProgress.current} of {extractBatchProgress.total}
            </span>
            <span style={{ color: "#666", display: "flex", gap: 12, alignItems: "center" }}>
              <span>{formatElapsed(elapsedMs)}</span>
              {costSoFar > 0 && <span>{formatCost(costSoFar)}</span>}
              <span>{extractPct}%</span>
            </span>
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
                width: `${extractPct}%`,
                background: "#059669",
                borderRadius: 4,
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {/* Extraction log */}
          {extractionResults.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 13, marginBottom: 12 }}>
              {extractionResults.map((item) => (
                <div
                  key={item.id}
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
                    {item.status === "ok" && `${item.problem_category}`}
                    {item.status === "error" && `Error: ${item.error}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleCancel}
            style={{
              padding: "6px 14px",
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* =================== REVIEWING PHASE =================== */}
      {phase === "reviewing" && (
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        >
          {/* Summary banner */}
          <div
            style={{
              padding: 12,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 600 }}>
              Extracted {successCount}/{extractionResults.length}
              {errorCount > 0 && ` (${errorCount} errors)`}
            </span>
            {extractionSummary && (
              <>
                <span>
                  <span style={{ color: "#64748b" }}>Tokens:</span>{" "}
                  {formatTokens(extractionSummary.inputTokens)} in / {formatTokens(extractionSummary.outputTokens)} out
                </span>
                <span>
                  <span style={{ color: "#64748b" }}>Cost:</span>{" "}
                  <strong>{formatCost(extractionSummary.estimatedCostCents)}</strong>
                </span>
              </>
            )}
          </div>

          {/* Review table */}
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "6px 10px", width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === successCount && successCount > 0}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                  <th style={{ padding: "6px 10px", color: "#64748b", fontWeight: 500 }}>Title</th>
                  <th style={{ padding: "6px 10px", color: "#64748b", fontWeight: 500 }}>Problem Category</th>
                  <th style={{ padding: "6px 10px", color: "#64748b", fontWeight: 500 }}>Vertical</th>
                  <th style={{ padding: "6px 10px", color: "#64748b", fontWeight: 500 }}>Budget</th>
                  <th style={{ padding: "6px 10px", color: "#64748b", fontWeight: 500 }}>Recurring?</th>
                </tr>
              </thead>
              <tbody>
                {extractionResults.map((item) => {
                  const isError = item.status === "error";
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: isError ? "#fef2f2" : isSelected ? "#f0fdf4" : undefined,
                        opacity: isError ? 0.6 : 1,
                      }}
                    >
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isError}
                          onChange={() => toggleItem(item.id)}
                          style={{ cursor: isError ? "not-allowed" : "pointer" }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                        {isError && (
                          <span style={{ color: "#dc2626", fontSize: 11, marginLeft: 6 }}>
                            Error: {item.error}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "6px 10px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.problem_category || "—"}
                      </td>
                      <td style={{ padding: "6px 10px" }}>{item.vertical || "—"}</td>
                      <td style={{ padding: "6px 10px" }}>
                        {item.budget_tier ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 9999,
                              fontSize: 11,
                              fontWeight: 600,
                              background:
                                item.budget_tier === "high" ? "#dcfce7" :
                                item.budget_tier === "low" ? "#fef2f2" : "#eff6ff",
                              color:
                                item.budget_tier === "high" ? "#166534" :
                                item.budget_tier === "low" ? "#991b1b" : "#1e40af",
                            }}
                          >
                            {item.budget_tier}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        {item.is_recurring_type_need != null ? (item.is_recurring_type_need ? "Yes" : "No") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={handleCluster}
              disabled={selectedIds.size === 0}
              style={{
                padding: "8px 18px",
                background: selectedIds.size > 0 ? "#059669" : "#d1d5db",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: selectedIds.size > 0 ? "pointer" : "not-allowed",
                fontSize: 13,
              }}
            >
              Continue to Clustering ({selectedIds.size} items)
            </button>
            <button
              onClick={handleSkipClustering}
              style={{
                padding: "8px 18px",
                background: "white",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontWeight: 500,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Skip Clustering
            </button>
            <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>
              Est. clustering cost: ~{formatCost(Math.ceil(selectedIds.size * 0.5))}
            </span>
          </div>
        </div>
      )}

      {/* =================== CLUSTERING PHASE =================== */}
      {phase === "clustering" && (
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
              Clustering {clusterProgress.current} of {clusterProgress.total}
            </span>
            <span style={{ color: "#666", display: "flex", gap: 12, alignItems: "center" }}>
              <span>{formatElapsed(elapsedMs)}</span>
              <span>{clusterPct}%</span>
            </span>
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
                width: `${clusterPct}%`,
                background: "#2563eb",
                borderRadius: 4,
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {/* Item log */}
          <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 13, marginBottom: 12 }}>
            {clusterProgressItems.map((item, i) => (
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
                  {item.status === "clustering" && "Clustering..."}
                  {item.status === "ok" && `→ ${item.cluster}`}
                  {item.status === "error" && `Error: ${item.error}`}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleCancel}
            style={{
              padding: "6px 14px",
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* =================== DONE PHASE =================== */}
      {phase === "done" && (extractionSummary || clusterSummary) && (
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Processing Complete</div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
            {extractionSummary && (
              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: 12,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Extraction (Run #{extractionSummary.runId})</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span>
                    <span style={{ color: "#64748b" }}>Tokens:</span>{" "}
                    {formatTokens(extractionSummary.inputTokens)} in / {formatTokens(extractionSummary.outputTokens)} out
                  </span>
                  <span>
                    <span style={{ color: "#64748b" }}>Cost:</span>{" "}
                    <strong>{formatCost(extractionSummary.estimatedCostCents)}</strong>
                  </span>
                  <span>
                    <span style={{ color: "#16a34a" }}>{extractionSummary.succeeded} ok</span>
                    {extractionSummary.failed > 0 && (
                      <span style={{ color: "#dc2626", marginLeft: 6 }}>{extractionSummary.failed} failed</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {clusterSummary && (
              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: 12,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Clustering (Run #{clusterSummary.runId})</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span>
                    <span style={{ color: "#64748b" }}>Tokens:</span>{" "}
                    {formatTokens(clusterSummary.inputTokens)} in / {formatTokens(clusterSummary.outputTokens)} out
                  </span>
                  <span>
                    <span style={{ color: "#64748b" }}>Cost:</span>{" "}
                    <strong>{formatCost(clusterSummary.estimatedCostCents)}</strong>
                  </span>
                  <span>
                    <span style={{ color: "#16a34a" }}>{clusterSummary.succeeded} ok</span>
                    {clusterSummary.failed > 0 && (
                      <span style={{ color: "#dc2626", marginLeft: 6 }}>{clusterSummary.failed} failed</span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Total cost */}
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
            Total cost: <strong>{formatCost((extractionSummary?.estimatedCostCents || 0) + (clusterSummary?.estimatedCostCents || 0))}</strong>
          </div>

          <button
            onClick={handleReset}
            style={{
              padding: "8px 18px",
              background: "#059669",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Process More
          </button>
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
        {phase === "idle" && (
          <button
            onClick={handleExtract}
            disabled={!stats || stats.unprocessed === 0}
            style={{
              padding: "10px 20px",
              background: stats && stats.unprocessed > 0 ? "#059669" : "#d1d5db",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: stats && stats.unprocessed > 0 ? "pointer" : "not-allowed",
            }}
          >
            Extract {stats ? Math.min(batchSize, stats.unprocessed) : 0} Listings
          </button>
        )}
      </div>

      {importStatus && phase === "idle" && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: importStatus.startsWith("Error") ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${importStatus.startsWith("Error") ? "#fecaca" : "#bbf7d0"}`,
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {importStatus}
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
