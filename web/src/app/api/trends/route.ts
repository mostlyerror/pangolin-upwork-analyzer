import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

// GET /api/trends — business problem patterns across all processed listings
export async function GET() {
  const [verticals, problemCategories, recurringProblems, budgetTiers, verticalBudgets, seasonality, globalGeography, globalTools, globalJobTiers, globalDurations, globalCategories, globalPaymentVerification, globalBarrierToEntry] = await Promise.all([
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

    // Seasonality — monthly listing volume for last 12 months
    query(`
      SELECT
        DATE_TRUNC('month', captured_at)::date AS month,
        COUNT(*) AS count,
        ROUND(AVG(COALESCE(budget_max, budget_min, 0))::numeric, 0) AS avg_budget
      FROM listings
      WHERE captured_at > now() - interval '12 months'
      GROUP BY DATE_TRUNC('month', captured_at)
      ORDER BY month
    `),

    // Global geography — top 10 buyer locations
    query(`
      SELECT b.location,
        COUNT(DISTINCT b.id) AS buyer_count,
        COUNT(DISTINCT l.id) AS listing_count
      FROM buyers b
      JOIN listings l ON l.buyer_id = b.id
      WHERE b.location IS NOT NULL
      GROUP BY b.location
      ORDER BY buyer_count DESC
      LIMIT 10
    `),

    // Global tools — top 20 tools across all listings
    query(`
      SELECT tool, COUNT(*) AS mention_count
      FROM (
        SELECT UNNEST(tools_mentioned) AS tool
        FROM listings
        WHERE tools_mentioned IS NOT NULL
      ) sub
      GROUP BY tool
      ORDER BY mention_count DESC
      LIMIT 20
    `),

    // Global job tier distribution
    query(`
      SELECT raw_data->'_meta'->>'tier' AS job_tier, COUNT(*) AS count
      FROM listings
      WHERE raw_data->'_meta'->>'tier' IS NOT NULL
      GROUP BY raw_data->'_meta'->>'tier'
      ORDER BY count DESC
    `),

    // Global duration distribution
    query(`
      SELECT raw_data->'_meta'->>'duration' AS duration, COUNT(*) AS count
      FROM listings
      WHERE raw_data->'_meta'->>'duration' IS NOT NULL
      GROUP BY raw_data->'_meta'->>'duration'
      ORDER BY count DESC
    `),

    // Global categories with avg budget
    query(`
      SELECT category, COUNT(*) AS count,
        ROUND(AVG(COALESCE(budget_max, budget_min, 0))::numeric, 0) AS avg_budget
      FROM listings
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
      LIMIT 15
    `),

    // Global payment verification
    queryOne(`
      SELECT
        COUNT(*) FILTER (WHERE (raw_data->'_meta'->>'paymentVerified')::boolean = true) AS verified_count,
        COUNT(*) FILTER (WHERE raw_data->'_meta'->>'paymentVerified' IS NOT NULL) AS total_with_data,
        CASE
          WHEN COUNT(*) FILTER (WHERE raw_data->'_meta'->>'paymentVerified' IS NOT NULL) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE (raw_data->'_meta'->>'paymentVerified')::boolean = true)::numeric /
            COUNT(*) FILTER (WHERE raw_data->'_meta'->>'paymentVerified' IS NOT NULL)::numeric * 100, 1)
          ELSE NULL
        END AS verification_rate
      FROM listings
    `),

    // Global barrier to entry
    queryOne(`
      SELECT
        ROUND(AVG((raw_data->'_meta'->>'connectPrice')::numeric), 1) AS avg_connect_price,
        COUNT(*) FILTER (WHERE (raw_data->'_meta'->>'enterprise')::boolean = true) AS enterprise_count,
        COUNT(*) FILTER (WHERE (raw_data->'_meta'->>'premium')::boolean = true) AS premium_count
      FROM listings
    `),
  ]);

  return NextResponse.json({
    verticals,
    problemCategories,
    recurringProblems: recurringProblems[0] || null,
    budgetTiers,
    verticalBudgets,
    seasonality,
    globalGeography,
    globalTools,
    globalJobTiers,
    globalDurations,
    globalCategories,
    globalPaymentVerification,
    globalBarrierToEntry,
  });
}
