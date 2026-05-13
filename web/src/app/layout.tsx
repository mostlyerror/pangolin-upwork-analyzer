import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pangolin",
  description: "Capture and review Upwork opportunity signals",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav style={{
          borderBottom: "1px solid #e5e7eb",
          padding: "12px 24px",
          display: "flex",
          gap: 24,
          alignItems: "center",
          background: "white",
        }}>
          <a href="/inbox" style={{ color: "#111827", fontWeight: 700, fontSize: 18 }}>
            Pangolin
          </a>
          <a href="/inbox" style={{ color: "#374151", fontSize: 14, fontWeight: 500 }}>Inbox</a>
          <a href="/opportunities" style={{ color: "#374151", fontSize: 14, fontWeight: 500 }}>Opportunities</a>
          <a href="/processing" style={{ color: "#374151", fontSize: 14, fontWeight: 500 }}>Processing</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
