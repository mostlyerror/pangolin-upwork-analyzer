"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  listingId: number;
  upworkUrl: string | null;
  reviewStatus: "inbox" | "archived" | "promoted";
}

export default function StatusActions({ listingId, upworkUrl, reviewStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: "inbox" | "archived" | "promoted") {
    setBusy(true);
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_status: status }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push(status === "promoted" ? "/opportunities" : "/inbox");
    } catch (err) {
      console.error("setStatus failed", err);
    } finally {
      setBusy(false);
    }
  }

  const btnBase: React.CSSProperties = {
    border: "none",
    borderRadius: 6,
    padding: "5px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.6 : 1,
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {reviewStatus !== "promoted" && (
        <button
          onClick={() => setStatus("promoted")}
          disabled={busy}
          style={{ ...btnBase, background: "#6366f1", color: "white" }}
        >
          Promote
        </button>
      )}

      {reviewStatus === "promoted" && (
        <button
          onClick={() => setStatus("inbox")}
          disabled={busy}
          style={{ ...btnBase, background: "white", color: "#64748b", border: "1px solid #e2e8f0" }}
        >
          Return to Inbox
        </button>
      )}

      {reviewStatus !== "archived" && (
        <button
          onClick={() => setStatus("archived")}
          disabled={busy}
          style={{ ...btnBase, background: "white", color: "#64748b", border: "1px solid #e2e8f0" }}
        >
          Archive
        </button>
      )}

      {reviewStatus === "archived" && (
        <button
          onClick={() => setStatus("inbox")}
          disabled={busy}
          style={{ ...btnBase, background: "white", color: "#64748b", border: "1px solid #e2e8f0" }}
        >
          Return to Inbox
        </button>
      )}

      {upworkUrl && (
        <a
          href={upworkUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#64748b",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 13,
            textDecoration: "none",
            background: "white",
          }}
        >
          ↗
        </a>
      )}
    </div>
  );
}
