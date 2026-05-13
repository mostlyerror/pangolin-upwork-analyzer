"use client";

import { useState } from "react";

type State = "idle" | "running" | "done" | "error";

interface Result {
  succeeded: number;
  failed: number;
  total: number;
  costCents: number;
}

export default function ProcessingControls({ rawCount }: { rawCount: number }) {
  const [state, setState] = useState<State>("idle");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function runExtraction() {
    setState("running");
    setProgress(null);
    setResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/process/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 200 }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "start") {
              setProgress({ done: 0, total: event.total });
            } else if (event.type === "batch_done") {
              setProgress((p) => p ? { ...p, done: p.done + (event.items?.length ?? 0) } : p);
            } else if (event.type === "done") {
              setResult({
                succeeded: event.succeeded ?? 0,
                failed: event.failed ?? 0,
                total: event.total ?? 0,
                costCents: event.costCents ?? 0,
              });
              setState("done");
            }
          } catch {}
        }
      }

      if (state !== "done") setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  const busy = state === "running";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={runExtraction}
          disabled={busy || rawCount === 0}
          style={{
            background: busy || rawCount === 0 ? "#e2e8f0" : "#6366f1",
            color: busy || rawCount === 0 ? "#94a3b8" : "white",
            border: "none",
            borderRadius: 6,
            padding: "8px 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: busy || rawCount === 0 ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Running…" : `Run AI Extraction (${rawCount} pending)`}
        </button>

        {busy && progress && (
          <span style={{ fontSize: 13, color: "#64748b" }}>
            {progress.done} / {progress.total} processed
          </span>
        )}
      </div>

      {state === "done" && result && (
        <div style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 6,
          padding: "10px 14px",
          fontSize: 13,
          color: "#166534",
        }}>
          Done — {result.succeeded} succeeded, {result.failed} failed
          {result.costCents > 0 && ` · $${(result.costCents / 100).toFixed(3)} estimated cost`}
        </div>
      )}

      {state === "error" && errorMsg && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 6,
          padding: "10px 14px",
          fontSize: 13,
          color: "#991b1b",
        }}>
          Error: {errorMsg}
        </div>
      )}

      {rawCount === 0 && state === "idle" && (
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
          No pending listings to process.
        </p>
      )}
    </div>
  );
}
