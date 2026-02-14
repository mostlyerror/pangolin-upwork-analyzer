export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h2 style={{ fontSize: 15, marginBottom: 12, color: "#374151" }}>{title}</h2>
      {children}
    </div>
  );
}
