import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pangolin",
  description: "Surface SaaS ideas and buyer lists from Upwork listings",
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
          <strong style={{ fontSize: 18 }}>Pangolin</strong>
          <a href="/">Discover</a>
          <a href="/import">Import</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
