import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

// GET /api/verticals/[name] — vertical detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const vertical = decodeURIComponent(name);

  const [
    summary,
    clusterOverlaps,
    topProblemCategories,
    toolHeatmap,
    jobTierDist,
    durationDist,
    geography,
    paymentVerification,
    barrierToEntry,
    listings,
  ] = await Promise.all([
    // Summary stats
    queryOne(
      `SELECT
        l.vertical,
        COUNT(*) AS listing_count,
        ROUND(AVG(COALESCE(l.budget_max, l.budget_min, 0))::numeric, 0) AS avg_budget,
        ROUND(SUM(COALESCE(l.budget_max, l.budget_min, 0))::numeric, 0) AS total_budget,
        COUNT(DISTINCT l.buyer_id) AS buyer_count,
        COUNT(*) FILTER (WHERE l.is_recurring_type_need = true) AS recurring_count,
        COUNT(*) FILTER (WHERE l.is_recurring_type_need = false) AS one_off_count,
        COUNT(*) FILTER (WHERE l.captured_at > now() - interval '7 days') AS listings_this_week,
        COUNT(*) FILTER (WHERE l.captured_at BETWEEN now() - interval '14 days' AND now() - interval '7 days') AS listings_last_week
       FROM listings l
       WHERE l.vertical = $1 AND l.ai_processed_at IS NOT NULL
       GROUP BY l.vertical`,
      [vertical]
    ),

    // Cluster overlaps — which clusters share this vertical's listings
    query(
      `SELECT
        c.id AS cluster_id,
        c.name AS cluster_name,
        COUNT(*) AS listing_count,
        ROUND(AVG(COALESCE(l.budget_max, l.budget_min, 0))::numeric, 0) AS avg_budget,
        c.heat_score
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       JOIN clusters c ON c.id = lc.cluster_id
       WHERE l.vertical = $1 AND l.ai_processed_at IS NOT NULL
       GROUP BY c.id, c.name, c.heat_score
       ORDER BY COUNT(*) DESC
       LIMIT 15`,
      [vertical]
    ),

    // Top problem categories
    query(
      `SELECT
        l.problem_category AS category,
        COUNT(*) AS count,
        ROUND(AVG(COALESCE(l.budget_max, l.budget_min, 0))::numeric, 0) AS avg_budget
       FROM listings l
       WHERE l.vertical = $1 AND l.problem_category IS NOT NULL AND l.ai_processed_at IS NOT NULL
       GROUP BY l.problem_category
       ORDER BY COUNT(*) DESC
       LIMIT 10`,
      [vertical]
    ),

    // Tool heatmap
    query(
      `SELECT tool, COUNT(*) AS mention_count
       FROM (
         SELECT UNNEST(l.tools_mentioned) AS tool
         FROM listings l
         WHERE l.vertical = $1 AND l.tools_mentioned IS NOT NULL AND l.ai_processed_at IS NOT NULL
       ) sub
       GROUP BY tool
       ORDER BY mention_count DESC
       LIMIT 15`,
      [vertical]
    ),

    // Job tier distribution
    query(
      `SELECT l.raw_data->'_meta'->>'tier' AS job_tier, COUNT(*) AS count
       FROM listings l
       WHERE l.vertical = $1 AND l.raw_data->'_meta'->>'tier' IS NOT NULL AND l.ai_processed_at IS NOT NULL
       GROUP BY l.raw_data->'_meta'->>'tier'
       ORDER BY count DESC`,
      [vertical]
    ),

    // Duration distribution
    query(
      `SELECT l.raw_data->'_meta'->>'duration' AS duration, COUNT(*) AS count
       FROM listings l
       WHERE l.vertical = $1 AND l.raw_data->'_meta'->>'duration' IS NOT NULL AND l.ai_processed_at IS NOT NULL
       GROUP BY l.raw_data->'_meta'->>'duration'
       ORDER BY count DESC`,
      [vertical]
    ),

    // Geography
    query(
      `SELECT b.location, COUNT(DISTINCT b.id) AS buyer_count
       FROM buyers b
       JOIN listings l ON l.buyer_id = b.id
       WHERE l.vertical = $1 AND b.location IS NOT NULL AND l.ai_processed_at IS NOT NULL
       GROUP BY b.location
       ORDER BY buyer_count DESC
       LIMIT 5`,
      [vertical]
    ),

    // Payment verification
    queryOne(
      `SELECT
        COUNT(*) FILTER (WHERE (l.raw_data->'_meta'->>'paymentVerified')::boolean = true) AS verified_count,
        COUNT(*) FILTER (WHERE l.raw_data->'_meta'->>'paymentVerified' IS NOT NULL) AS total_with_data,
        CASE
          WHEN COUNT(*) FILTER (WHERE l.raw_data->'_meta'->>'paymentVerified' IS NOT NULL) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE (l.raw_data->'_meta'->>'paymentVerified')::boolean = true)::numeric /
            COUNT(*) FILTER (WHERE l.raw_data->'_meta'->>'paymentVerified' IS NOT NULL)::numeric * 100, 1)
          ELSE NULL
        END AS verification_rate
       FROM listings l
       WHERE l.vertical = $1 AND l.ai_processed_at IS NOT NULL`,
      [vertical]
    ),

    // Barrier to entry
    queryOne(
      `SELECT
        ROUND(AVG((l.raw_data->'_meta'->>'connectPrice')::numeric), 1) AS avg_connect_price,
        MIN((l.raw_data->'_meta'->>'connectPrice')::int) AS min_connect_price,
        MAX((l.raw_data->'_meta'->>'connectPrice')::int) AS max_connect_price,
        COUNT(*) FILTER (WHERE (l.raw_data->'_meta'->>'enterprise')::boolean = true) AS enterprise_count,
        COUNT(*) FILTER (WHERE (l.raw_data->'_meta'->>'premium')::boolean = true) AS premium_count
       FROM listings l
       WHERE l.vertical = $1 AND l.ai_processed_at IS NOT NULL`,
      [vertical]
    ),

    // Listings (limit 100)
    query(
      `SELECT l.*,
        l.raw_data->'_meta'->>'proposalsTier' AS proposal_tier,
        l.raw_data->'_meta'->>'tier' AS job_tier,
        l.raw_data->'_meta'->>'duration' AS engagement_duration,
        (l.raw_data->'_meta'->>'connectPrice')::int AS connect_price,
        (l.raw_data->'_meta'->>'paymentVerified')::boolean AS payment_verified,
        (l.raw_data->'_meta'->>'enterprise')::boolean AS is_enterprise,
        (l.raw_data->'_meta'->>'premium')::boolean AS is_premium
       FROM listings l
       WHERE l.vertical = $1 AND l.ai_processed_at IS NOT NULL
       ORDER BY l.captured_at DESC
       LIMIT 100`,
      [vertical]
    ),
  ]);

  if (!summary) {
    return NextResponse.json({ error: "Vertical not found" }, { status: 404 });
  }

  return NextResponse.json({
    summary,
    clusterOverlaps,
    topProblemCategories,
    toolHeatmap,
    jobTierDist,
    durationDist,
    geography,
    paymentVerification,
    barrierToEntry,
    listings,
  });
}
