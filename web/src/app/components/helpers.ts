export function fmt$(n: string | number | null | undefined) {
  if (n == null) return "—";
  return "$" + Math.round(Number(n)).toLocaleString();
}

export function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: "6px 14px",
    background: bg,
    color: "white",
    border: "none",
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 13,
  };
}

export const selectStyle: React.CSSProperties = {
  padding: "4px 6px",
  borderRadius: 4,
  border: "1px solid #d1d5db",
  fontSize: 12,
  background: "white",
};
