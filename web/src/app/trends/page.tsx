"use client";

import { useEffect, useState } from "react";

interface Vertical {
  vertical: string;
  count: string;
  avg_budget: string;
  buyer_count: string;
  total_budget: string;
}

interface ProblemCategory {
  problem_category: string;
  count: string;
  avg_budget: string;
  buyer_count: string;
  verticals: string[];
}

interface RecurringProblems {
  recurring: string;
  one_off: string;
  recurring_avg_budget: string;
  one_off_avg_budget: string;
}

interface BudgetTier {
  budget_tier: string;
  count: string;
}

interface VerticalBudget {
  vertical: string;
  avg_budget: string;
  total_budget: string;
  count: string;
}

interface TrendsData {
  verticals: Vertical[];
  problemCategories: ProblemCategory[];
  recurringProblems: RecurringProblems | null;
  budgetTiers: BudgetTier[];
  verticalBudgets: VerticalBudget[];
}

function fmt$(n: string | number | null) {
  if (n == null) return "—";
  return "$" + Math.round(Number(n)).toLocaleString();
}

function BarInline({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, color: "#666", minWidth: 24, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function TrendsPage() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trends")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (!data) return <p style={{ padding: 24 }}>No data.</p>;

  const maxVertical = Math.max(...data.verticals.map((v) => Number(v.count)), 1);
  const maxProblem = Math.max(...data.problemCategories.map((p) => Number(p.count)), 1);
  const totalBudget = data.budgetTiers.reduce((sum, b) => sum + Number(b.count), 0) || 1;
  const maxVertBudget = Math.max(...data.verticalBudgets.map((v) => Number(v.total_budget)), 1);

  const rp = data.recurringProblems;
  const recurringTotal = rp ? Number(rp.recurring) + Number(rp.one_off) : 0;
  const recurringPct = recurringTotal > 0 ? Math.round((Number(rp?.recurring) / recurringTotal) * 100) : 0;

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Business Problem Trends</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
        What problems are people paying to solve?
      </p>

      {/* Recurring vs one-off callout */}
      {rp && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20,
        }}>
          <div style={{
            padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8,
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#059669" }}>{recurringPct}%</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
              recurring problems ({rp.recurring} listings) — avg {fmt$(rp.recurring_avg_budget)}
            </div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              These are problems many businesses share. Stronger product signal.
            </div>
          </div>
          <div style={{
            padding: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8,
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#6b7280" }}>{100 - recurringPct}%</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
              one-off problems ({rp.one_off} listings) — avg {fmt$(rp.one_off_avg_budget)}
            </div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              Custom/unique needs. Less likely to be productizable.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Problem categories */}
        <Section title="Top Problem Categories">
          {data.problemCategories.map((p) => (
            <div key={p.problem_category} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                {p.problem_category}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888", marginBottom: 4 }}>
                <span>avg {fmt$(p.avg_budget)} &middot; {p.buyer_count} buyers</span>
                <span>{p.verticals?.slice(0, 2).join(", ")}</span>
              </div>
              <BarInline value={Number(p.count)} max={maxProblem} color="#7c3aed" />
            </div>
          ))}
        </Section>

        {/* Verticals */}
        <Section title="Industries">
          {data.verticals.map((v) => (
            <div key={v.vertical} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
                <span style={{ fontWeight: 500 }}>{v.vertical}</span>
                <span style={{ color: "#888", fontSize: 12 }}>
                  avg {fmt$(v.avg_budget)} &middot; {v.buyer_count} buyers
                </span>
              </div>
              <BarInline value={Number(v.count)} max={maxVertical} color="#2563eb" />
            </div>
          ))}
        </Section>

        {/* Where the money is */}
        <Section title="Where the Money Is">
          <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
            Industries by total budget across all listings
          </p>
          {data.verticalBudgets.map((v) => (
            <div key={v.vertical} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
                <span style={{ fontWeight: 500 }}>{v.vertical}</span>
                <span style={{ color: "#888", fontSize: 12 }}>
                  {fmt$(v.total_budget)} total &middot; {fmt$(v.avg_budget)} avg &middot; {v.count} listings
                </span>
              </div>
              <BarInline value={Number(v.total_budget)} max={maxVertBudget} color="#059669" />
            </div>
          ))}
        </Section>

        {/* Budget distribution */}
        <Section title="Budget Distribution">
          {data.budgetTiers.map((b) => {
            const pct = Math.round((Number(b.count) / totalBudget) * 100);
            const labels: Record<string, string> = {
              high: "High (>$5k)", mid: "Mid ($500–$5k)", low: "Low (<$500)",
            };
            const colors: Record<string, string> = {
              high: "#059669", mid: "#2563eb", low: "#9ca3af",
            };
            return (
              <div key={b.budget_tier} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{labels[b.budget_tier] || b.budget_tier}</span>
                  <span style={{ color: "#888" }}>{b.count} ({pct}%)</span>
                </div>
                <div style={{ height: 8, background: "#e5e7eb", borderRadius: 4 }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: colors[b.budget_tier] || "#888", borderRadius: 4,
                  }} />
                </div>
              </div>
            );
          })}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16,
    }}>
      <h2 style={{ fontSize: 15, marginBottom: 12, color: "#374151" }}>{title}</h2>
      {children}
    </div>
  );
}
