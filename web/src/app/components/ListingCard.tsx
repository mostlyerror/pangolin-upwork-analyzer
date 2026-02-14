"use client";

import { useState } from "react";
import type { Listing, Cluster } from "./types";

const KNOWN_TOOLS = [
  "salesforce", "hubspot", "zapier", "shopify", "wordpress", "woocommerce",
  "stripe", "quickbooks", "xero", "slack", "notion", "airtable", "monday",
  "asana", "trello", "jira", "confluence", "google sheets", "excel",
  "mailchimp", "klaviyo", "sendgrid", "twilio", "aws", "azure", "gcp",
  "firebase", "supabase", "postgresql", "mysql", "mongodb", "redis",
  "docker", "kubernetes", "terraform", "github", "gitlab", "bitbucket",
  "figma", "webflow", "bubble", "make", "power automate", "zoho",
  "pipedrive", "freshdesk", "zendesk", "intercom", "segment", "mixpanel",
  "amplitude", "tableau", "power bi", "looker", "datadog", "sentry",
  "clickup", "basecamp", "linear", "retool", "n8n",
];

export function ListingCard({
  listing: l,
  isOverlap,
  otherClusterNames,
  tierColors,
  clusterId,
  clusters,
  onFeedback,
  onReassign,
}: {
  listing: Listing;
  isOverlap?: boolean;
  otherClusterNames?: string[];
  tierColors: Record<string, string>;
  clusterId?: number;
  clusters?: Cluster[];
  onFeedback?: (listingId: number, clusterId: number | null, type: string) => void;
  onReassign?: (listingId: number, oldClusterId: number, newClusterId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<number | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, boolean>>({});

  // Detect tools in description that are missing from tools_mentioned
  const extractedTools = (l.tools_mentioned ?? []).map((t) => t.toLowerCase());
  const descLower = (l.description ?? "").toLowerCase();
  const missingTools = KNOWN_TOOLS.filter(
    (t) => descLower.includes(t) && !extractedTools.some((et) => et.includes(t))
  );

  function sendFeedback(type: string) {
    if (feedbackSent[type]) return;
    onFeedback?.(l.id, clusterId ?? null, type);
    setFeedbackSent((prev) => ({ ...prev, [type]: true }));
  }

  function handleReassign() {
    if (!reassignTarget || !clusterId) return;
    onReassign?.(l.id, clusterId, reassignTarget);
    setShowReassign(false);
    setReassignTarget(null);
    setFeedbackSent((prev) => ({ ...prev, reassign: true }));
  }

  return (
    <div
      style={{
        padding: 14,
        background: "white",
        borderRadius: 8,
        border: isOverlap ? "1px solid #c4b5fd" : "1px solid #e5e7eb",
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <strong>{l.title}</strong>
          {l.ai_confidence != null && l.ai_confidence < 0.5 && (
            <span
              style={{
                marginLeft: 8,
                background: "#fef3c7",
                color: "#92400e",
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              Low confidence ({l.ai_confidence.toFixed(2)})
            </span>
          )}
          {isOverlap && otherClusterNames && otherClusterNames.length > 0 && (
            <span
              style={{
                marginLeft: 8,
                background: "#ede9fe",
                color: "#6d28d9",
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              Also in: {otherClusterNames.join(", ")}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {l.job_tier && (
            <span
              style={{
                background: tierColors[l.job_tier] ? `${tierColors[l.job_tier]}18` : "#f3f4f6",
                color: tierColors[l.job_tier] ?? "#374151",
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              {l.job_tier}
            </span>
          )}
          {l.is_enterprise && (
            <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4 }}>
              Enterprise
            </span>
          )}
          {l.is_premium && (
            <span style={{ background: "#ede9fe", color: "#6d28d9", fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4 }}>
              Premium
            </span>
          )}
          {l.connect_price != null && (
            <span style={{ background: "#f0f9ff", color: "#0369a1", fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4 }}>
              {l.connect_price} connects
            </span>
          )}
          {l.payment_verified && (
            <span style={{ color: "#059669", fontSize: 12, fontWeight: 700 }} title="Payment verified">
              ✓
            </span>
          )}
          {l.proposal_tier && (
            <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4 }}>
              {l.proposal_tier}
            </span>
          )}
          {l.budget_min != null && (
            <span style={{ color: "#666", fontSize: 13 }}>
              ${Number(l.budget_min).toLocaleString()}
              {l.budget_max && l.budget_max !== l.budget_min
                ? ` - $${Number(l.budget_max).toLocaleString()}`
                : ""}
              {l.budget_type === "hourly" ? "/hr" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {l.description && !expanded && (
        <p style={{ color: "#555", fontSize: 13, marginTop: 6 }}>
          {l.description.length > 200 ? l.description.slice(0, 200) + "..." : l.description}
        </p>
      )}

      {/* Workflow */}
      {l.workflow_described && !expanded && (
        <blockquote
          style={{
            margin: "8px 0 0 0",
            padding: "6px 12px",
            borderLeft: "3px solid #e5e7eb",
            color: "#6b7280",
            fontSize: 12,
            fontStyle: "italic",
          }}
        >
          {l.workflow_described.length > 200
            ? l.workflow_described.slice(0, 200) + "..."
            : l.workflow_described}
        </blockquote>
      )}

      {/* Skills pills */}
      {l.skills && l.skills.length > 0 && !expanded && (
        <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
          {l.skills.map((skill) => (
            <span
              key={skill}
              style={{
                background: "#f3f4f6",
                color: "#374151",
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Metadata row */}
      <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 12, color: "#999", flexWrap: "wrap", alignItems: "center" }}>
        {l.vertical && <span>{l.vertical}</span>}
        {l.category && <span>{l.category}</span>}
        {l.engagement_duration && <span>{l.engagement_duration}</span>}
        {l.posted_at && (
          <span>
            Posted{" "}
            {new Date(l.posted_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}
        {l.is_recurring_type_need && (
          <span style={{ background: "#f0fdf4", color: "#059669", fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 4 }}>
            Recurring
          </span>
        )}
        {l.tools_mentioned && l.tools_mentioned.length > 0 && (
          <span>Tools: {l.tools_mentioned.join(", ")}</span>
        )}
        {l.upwork_url && (
          <a href={l.upwork_url} target="_blank" rel="noopener noreferrer">
            View on Upwork
          </a>
        )}

        {/* Spot-check toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: expanded ? "#dbeafe" : "#f3f4f6",
            color: expanded ? "#1d4ed8" : "#374151",
            border: "none",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
          }}
        >
          {expanded ? "Collapse" : "Spot-check"}
        </button>

        {/* Feedback buttons */}
        {onFeedback && (
          <>
            <button
              onClick={() => sendFeedback("extraction_correct")}
              disabled={!!feedbackSent["extraction_correct"]}
              style={{
                background: feedbackSent["extraction_correct"] ? "#d1fae5" : "transparent",
                color: feedbackSent["extraction_correct"] ? "#059669" : "#9ca3af",
                border: "none",
                fontSize: 14,
                padding: "0 4px",
                lineHeight: 1,
              }}
              title="Extraction looks correct"
            >
              ↑
            </button>
            <button
              onClick={() => sendFeedback("extraction_wrong")}
              disabled={!!feedbackSent["extraction_wrong"]}
              style={{
                background: feedbackSent["extraction_wrong"] ? "#fee2e2" : "transparent",
                color: feedbackSent["extraction_wrong"] ? "#dc2626" : "#9ca3af",
                border: "none",
                fontSize: 14,
                padding: "0 4px",
                lineHeight: 1,
              }}
              title="Extraction is wrong"
            >
              ↓
            </button>
          </>
        )}

        {/* Reassign button */}
        {onReassign && clusterId && clusters && (
          <button
            onClick={() => setShowReassign(!showReassign)}
            style={{
              background: "transparent",
              color: "#6b7280",
              border: "none",
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              textDecoration: "underline",
            }}
          >
            Reassign
          </button>
        )}
      </div>

      {/* Reassign panel */}
      {showReassign && clusters && clusterId && (
        <div style={{ marginTop: 8, padding: 10, background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={reassignTarget ?? ""}
              onChange={(e) => setReassignTarget(Number(e.target.value) || null)}
              style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 12, flex: 1 }}
            >
              <option value="">Move to cluster...</option>
              {clusters
                .filter((c) => c.id !== clusterId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.listing_count} listings)
                  </option>
                ))}
            </select>
            <button
              onClick={handleReassign}
              disabled={!reassignTarget}
              style={{
                padding: "4px 12px",
                background: reassignTarget ? "#2563eb" : "#d1d5db",
                color: "white",
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Confirm
            </button>
            <button
              onClick={() => { setShowReassign(false); setReassignTarget(null); }}
              style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 12 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Spot-check panel (expanded) */}
      {expanded && (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            padding: 12,
            background: "#f9fafb",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
          }}
        >
          {/* Left: Raw data */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Raw
            </div>
            {l.description && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 2 }}>Description</div>
                <p style={{ fontSize: 12, color: "#555", margin: 0, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
                  {l.description}
                </p>
              </div>
            )}
            {l.skills && l.skills.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 2 }}>Skills</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {l.skills.map((s) => (
                    <span key={s} style={{ background: "#e5e7eb", color: "#374151", fontSize: 10, padding: "1px 6px", borderRadius: 8 }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: AI Extraction */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              AI Extraction
            </div>
            <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              <div><span style={{ fontWeight: 600 }}>Problem:</span> {l.problem_category || "—"}</div>
              <div><span style={{ fontWeight: 600 }}>Vertical:</span> {l.vertical || "—"}</div>
              <div><span style={{ fontWeight: 600 }}>Workflow:</span> {l.workflow_described || "—"}</div>
              <div>
                <span style={{ fontWeight: 600 }}>Tools:</span>{" "}
                {l.tools_mentioned && l.tools_mentioned.length > 0
                  ? l.tools_mentioned.join(", ")
                  : "—"}
              </div>
              <div><span style={{ fontWeight: 600 }}>Budget tier:</span> {l.budget_type || "—"}</div>
              <div><span style={{ fontWeight: 600 }}>Recurring:</span> {l.is_recurring_type_need ? "Yes" : "No"}</div>
              <div>
                <span style={{ fontWeight: 600 }}>Confidence:</span>{" "}
                <span style={{ color: (l.ai_confidence ?? 0.5) < 0.5 ? "#d97706" : "#059669", fontWeight: 600 }}>
                  {l.ai_confidence != null ? l.ai_confidence.toFixed(2) : "—"}
                </span>
              </div>
            </div>

            {/* Highlight missing tools */}
            {missingTools.length > 0 && (
              <div style={{ marginTop: 8, padding: 6, background: "#fef3c7", borderRadius: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
                  Tools found in description but not extracted:
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {missingTools.map((t) => (
                    <span key={t} style={{ background: "#fde68a", color: "#78350f", fontSize: 10, padding: "1px 6px", borderRadius: 8, fontWeight: 600 }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
