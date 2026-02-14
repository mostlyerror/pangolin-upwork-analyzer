import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { interpretCluster, type ClusterStatsSummary } from "@/lib/ai";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clusterId = Number(id);

  const cluster = await queryOne<{
    id: number;
    name: string;
    description: string | null;
    listing_count: number;
    avg_budget: number | null;
    heat_score: number;
    velocity: number;
  }>("SELECT * FROM clusters WHERE id = $1", [clusterId]);

  if (!cluster) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  // Assemble stats summary from aggregate queries
  const [
    budgetStats,
    buyerStats,
    geography,
    paymentVerification,
    jobTierRows,
    proposalTierRows,
    barrierToEntry,
    durationRows,
    toolRows,
    categoryRows,
    clusterDates,
  ] = await Promise.all([
    queryOne<{ budget_stddev: string; budget_floor: string; budget_ceiling: string }>(
      `SELECT
        ROUND(STDDEV(COALESCE(l.budget_max, l.budget_min, 0))::numeric, 0) AS budget_stddev,
        MIN(COALESCE(l.budget_min, l.budget_max)) AS budget_floor,
        MAX(COALESCE(l.budget_max, l.budget_min)) AS budget_ceiling
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1`,
      [clusterId]
    ),
    queryOne<{ buyer_count: string; repeat_buyer_count: string; top_quality_scores: number[] }>(
      `SELECT
        COUNT(DISTINCT b.id) AS buyer_count,
        COUNT(DISTINCT b.id) FILTER (WHERE (
          SELECT COUNT(*) FROM listings l2
          JOIN listing_clusters lc2 ON lc2.listing_id = l2.id
          WHERE l2.buyer_id = b.id AND lc2.cluster_id = $1
        ) > 1) AS repeat_buyer_count,
        ARRAY(
          SELECT ROUND((b2.hire_rate *
            CASE WHEN b2.total_spent LIKE '$1M%' THEN 10000
                 WHEN b2.total_spent LIKE '$500K%' THEN 5000
                 WHEN b2.total_spent LIKE '$100K%' THEN 1000
                 WHEN b2.total_spent LIKE '$50K%' THEN 500
                 WHEN b2.total_spent LIKE '$10K%' THEN 100
                 WHEN b2.total_spent LIKE '$5K%' THEN 50
                 WHEN b2.total_spent LIKE '$1K%' THEN 10
                 ELSE 0
            END)::numeric, 0)
          FROM buyers b2
          JOIN listings l3 ON l3.buyer_id = b2.id
          JOIN listing_clusters lc3 ON lc3.listing_id = l3.id
          WHERE lc3.cluster_id = $1 AND b2.hire_rate IS NOT NULL
          ORDER BY 1 DESC
          LIMIT 3
        ) AS top_quality_scores
       FROM buyers b
       JOIN listings l ON l.buyer_id = b.id
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1`,
      [clusterId]
    ),
    query<{ location: string }>(
      `SELECT b.location
       FROM buyers b
       JOIN listings l ON l.buyer_id = b.id
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1 AND b.location IS NOT NULL
       GROUP BY b.location
       ORDER BY COUNT(DISTINCT b.id) DESC
       LIMIT 5`,
      [clusterId]
    ),
    queryOne<{ verification_rate: string | null }>(
      `SELECT
        CASE
          WHEN COUNT(*) FILTER (WHERE l.raw_data->'_meta'->>'paymentVerified' IS NOT NULL) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE (l.raw_data->'_meta'->>'paymentVerified')::boolean = true)::numeric /
            COUNT(*) FILTER (WHERE l.raw_data->'_meta'->>'paymentVerified' IS NOT NULL)::numeric * 100, 1)
          ELSE NULL
        END AS verification_rate
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1`,
      [clusterId]
    ),
    query<{ job_tier: string; count: string }>(
      `SELECT l.raw_data->'_meta'->>'tier' AS job_tier, COUNT(*) AS count
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1 AND l.raw_data->'_meta'->>'tier' IS NOT NULL
       GROUP BY 1 ORDER BY count DESC`,
      [clusterId]
    ),
    query<{ proposal_tier: string; count: string }>(
      `SELECT l.raw_data->'_meta'->>'proposalsTier' AS proposal_tier, COUNT(*) AS count
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1 AND l.raw_data->'_meta'->>'proposalsTier' IS NOT NULL
       GROUP BY 1 ORDER BY count DESC`,
      [clusterId]
    ),
    queryOne<{ avg_connect_price: string | null; enterprise_count: string; premium_count: string }>(
      `SELECT
        ROUND(AVG((l.raw_data->'_meta'->>'connectPrice')::numeric), 1) AS avg_connect_price,
        COUNT(*) FILTER (WHERE (l.raw_data->'_meta'->>'enterprise')::boolean = true) AS enterprise_count,
        COUNT(*) FILTER (WHERE (l.raw_data->'_meta'->>'premium')::boolean = true) AS premium_count
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1`,
      [clusterId]
    ),
    query<{ duration: string; count: string }>(
      `SELECT l.raw_data->'_meta'->>'duration' AS duration, COUNT(*) AS count
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1 AND l.raw_data->'_meta'->>'duration' IS NOT NULL
       GROUP BY 1 ORDER BY count DESC`,
      [clusterId]
    ),
    query<{ tool: string }>(
      `SELECT tool FROM (
         SELECT UNNEST(l.tools_mentioned) AS tool
         FROM listings l
         JOIN listing_clusters lc ON lc.listing_id = l.id
         WHERE lc.cluster_id = $1 AND l.tools_mentioned IS NOT NULL
       ) sub
       GROUP BY tool
       ORDER BY COUNT(*) DESC
       LIMIT 10`,
      [clusterId]
    ),
    query<{ category: string }>(
      `SELECT l.category
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1 AND l.category IS NOT NULL
       GROUP BY l.category
       ORDER BY COUNT(*) DESC
       LIMIT 5`,
      [clusterId]
    ),
    queryOne<{ latest_listing_at: string | null }>(
      `SELECT MAX(l.captured_at) AS latest_listing_at
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1`,
      [clusterId]
    ),
  ]);

  const buyerCount = Number(buyerStats?.buyer_count ?? 0);
  const repeatCount = Number(buyerStats?.repeat_buyer_count ?? 0);
  const latestAt = clusterDates?.latest_listing_at ? new Date(clusterDates.latest_listing_at) : null;
  const daysSince = latestAt ? Math.floor((Date.now() - latestAt.getTime()) / (1000 * 60 * 60 * 24)) : null;

  const statsSummary: ClusterStatsSummary = {
    name: cluster.name,
    description: cluster.description,
    listing_count: cluster.listing_count,
    avg_budget: cluster.avg_budget != null ? Number(cluster.avg_budget) : null,
    heat_score: Number(cluster.heat_score),
    velocity: Number(cluster.velocity),
    budget_floor: budgetStats?.budget_floor != null ? Number(budgetStats.budget_floor) : null,
    budget_ceiling: budgetStats?.budget_ceiling != null ? Number(budgetStats.budget_ceiling) : null,
    budget_stddev: budgetStats?.budget_stddev != null ? Number(budgetStats.budget_stddev) : null,
    buyer_count: buyerCount,
    top_locations: geography.map((g) => g.location),
    repeat_buyer_pct: buyerCount > 0 ? Math.round((repeatCount / buyerCount) * 100) : null,
    top_quality_scores: (buyerStats?.top_quality_scores ?? []).map(Number),
    payment_verification_rate: paymentVerification?.verification_rate != null
      ? Number(paymentVerification.verification_rate)
      : null,
    job_tier_dist: Object.fromEntries(jobTierRows.map((r) => [r.job_tier, Number(r.count)])),
    proposal_tier_dist: Object.fromEntries(proposalTierRows.map((r) => [r.proposal_tier, Number(r.count)])),
    avg_connect_price: barrierToEntry?.avg_connect_price != null
      ? Number(barrierToEntry.avg_connect_price)
      : null,
    enterprise_count: Number(barrierToEntry?.enterprise_count ?? 0),
    premium_count: Number(barrierToEntry?.premium_count ?? 0),
    duration_dist: Object.fromEntries(durationRows.map((r) => [r.duration, Number(r.count)])),
    top_tools: toolRows.map((r) => r.tool),
    top_categories: categoryRows.map((r) => r.category),
    days_since_last_listing: daysSince,
  };

  const { result: interpretation, usage } = await interpretCluster(statsSummary);

  // Cache in DB
  await queryOne(
    `UPDATE clusters SET ai_interpretation = $1, ai_interpretation_at = now() WHERE id = $2 RETURNING id`,
    [interpretation, clusterId]
  );

  return NextResponse.json({
    interpretation,
    generated_at: new Date().toISOString(),
    usage,
  });
}
