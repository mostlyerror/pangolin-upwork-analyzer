import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/trends — business problem patterns across all processed listings
export async function GET() {
  const [verticals, problemCategories, recurringProblems, budgetTiers, verticalBudgets] = await Promise.all([
    // Verticals ranked by frequency
    query(`
      SELECT vertical, COUNT(*) AS count,
        ROUND(AVG(COALESCE(budget_max, budget_min, 0))::numeric, 0) AS avg_budget,
        COUNT(DISTINCT buyer_id) FILTER (WHERE buyer_id IS NOT NULL) AS buyer_count,
        SUM(COALESCE(budget_max, budget_min, 0)) AS total_budget
      FROM listings
      WHERE vertical IS NOT NULL AND ai_processed_at IS NOT NULL
      GROUP BY vertical
      ORDER BY count DESC
    `),

    // Top problem categories (more granular than clusters — raw AI extraction)
    query(`
      SELECT problem_category, COUNT(*) AS count,
        ROUND(AVG(COALESCE(budget_max, budget_min, 0))::numeric, 0) AS avg_budget,
        COUNT(DISTINCT buyer_id) FILTER (WHERE buyer_id IS NOT NULL) AS buyer_count,
        ARRAY_AGG(DISTINCT vertical) FILTER (WHERE vertical IS NOT NULL) AS verticals
      FROM listings
      WHERE problem_category IS NOT NULL AND ai_processed_at IS NOT NULL
      GROUP BY problem_category
      ORDER BY count DESC
      LIMIT 20
    `),

    // Recurring vs one-off problems
    query(`
      SELECT
        COUNT(*) FILTER (WHERE is_recurring_type_need = true) AS recurring,
        COUNT(*) FILTER (WHERE is_recurring_type_need = false) AS one_off,
        ROUND(AVG(COALESCE(budget_max, budget_min, 0)) FILTER (WHERE is_recurring_type_need = true)::numeric, 0) AS recurring_avg_budget,
        ROUND(AVG(COALESCE(budget_max, budget_min, 0)) FILTER (WHERE is_recurring_type_need = false)::numeric, 0) AS one_off_avg_budget
      FROM listings
      WHERE ai_processed_at IS NOT NULL
    `),

    // Budget tier distribution
    query(`
      SELECT budget_tier, COUNT(*) AS count
      FROM listings
      WHERE budget_tier IS NOT NULL AND ai_processed_at IS NOT NULL
      GROUP BY budget_tier
      ORDER BY CASE budget_tier WHEN 'high' THEN 1 WHEN 'mid' THEN 2 WHEN 'low' THEN 3 END
    `),

    // Vertical x budget — which industries spend the most
    query(`
      SELECT vertical,
        ROUND(AVG(COALESCE(budget_max, budget_min, 0))::numeric, 0) AS avg_budget,
        ROUND(SUM(COALESCE(budget_max, budget_min, 0))::numeric, 0) AS total_budget,
        COUNT(*) AS count
      FROM listings
      WHERE vertical IS NOT NULL AND ai_processed_at IS NOT NULL
      GROUP BY vertical
      ORDER BY total_budget DESC
      LIMIT 10
    `),
  ]);

  return NextResponse.json({
    verticals,
    problemCategories,
    recurringProblems: recurringProblems[0] || null,
    budgetTiers,
    verticalBudgets,
  });
}
