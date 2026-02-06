"use client";

import { useState } from "react";

export default function ImportPage() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleImport() {
    setStatus("Importing...");
    try {
      // Try to parse as JSON array of listings
      let listings;
      try {
        const parsed = JSON.parse(input);
        listings = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Treat as a single pasted listing — title on first line, rest is description
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
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  }

  async function handleProcess() {
    setProcessing(true);
    setStatus("Running AI extraction + clustering...");
    try {
      const res = await fetch("/api/process", { method: "POST" });
      const result = await res.json();
      setStatus(
        `Processed ${result.processed} listing(s). ${result.results
          ?.map((r: any) => `#${r.id}: ${r.status}${r.cluster ? ` → ${r.cluster}` : ""}`)
          .join(", ") || result.message}`
      );
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
    setProcessing(false);
  }

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Import Listings</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>
        Paste JSON from the Chrome extension, or paste a raw listing (title on
        first line, description below).
      </p>

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
          onClick={handleProcess}
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

      {status && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: status.startsWith("Error") ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${status.startsWith("Error") ? "#fecaca" : "#bbf7d0"}`,
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
