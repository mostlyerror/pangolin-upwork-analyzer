import type { SidebarMode } from "./types";

export function SidebarModeToggle({
  mode,
  onChange,
}: {
  mode: SidebarMode;
  onChange: (mode: SidebarMode) => void;
}) {
  const base: React.CSSProperties = {
    padding: "5px 14px",
    fontSize: 12,
    fontWeight: 600,
    border: "none",
    transition: "background 0.15s, color 0.15s",
  };
  const active: React.CSSProperties = {
    ...base,
    background: "#2563eb",
    color: "white",
  };
  const inactive: React.CSSProperties = {
    ...base,
    background: "#f3f4f6",
    color: "#6b7280",
  };

  return (
    <div
      style={{
        display: "inline-flex",
        borderRadius: 6,
        overflow: "hidden",
        border: "1px solid #d1d5db",
      }}
    >
      <button
        onClick={() => onChange("clusters")}
        style={{
          ...(mode === "clusters" ? active : inactive),
          borderRadius: "5px 0 0 5px",
        }}
      >
        Clusters
      </button>
      <button
        onClick={() => onChange("niches")}
        style={{
          ...(mode === "niches" ? active : inactive),
          borderRadius: "0 5px 5px 0",
        }}
      >
        Niches
      </button>
    </div>
  );
}
