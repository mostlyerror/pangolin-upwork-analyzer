export function BarInline({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3 }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
          }}
        />
      </div>
      <span
        style={{ fontSize: 12, color: "#666", minWidth: 24, textAlign: "right", whiteSpace: "nowrap" }}
      >
        {value}{label ? ` ${label}` : ""}
      </span>
    </div>
  );
}
