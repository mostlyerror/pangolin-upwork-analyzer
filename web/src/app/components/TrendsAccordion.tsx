export function TrendsAccordion({
  title,
  id,
  expanded,
  setExpanded,
  children,
}: {
  title: string;
  id: string;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  children: React.ReactNode;
}) {
  const isOpen = !!expanded[id];
  return (
    <div style={{ borderBottom: "1px solid #f3f4f6" }}>
      <div
        onClick={() => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))}
        style={{
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 600,
          color: "#374151",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f9fafb",
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10, color: "#999" }}>{isOpen ? "▾" : "▸"}</span>
      </div>
      {isOpen && <div style={{ padding: "6px 12px 10px" }}>{children}</div>}
    </div>
  );
}
