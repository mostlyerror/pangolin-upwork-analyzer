import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import type { Cluster, Listing } from "@/types";

// GET /api/clusters/:id — cluster detail + its listings + buyers
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clusterId = Number(id);

  const cluster = await queryOne<Cluster>(
    "SELECT * FROM clusters WHERE id = $1",
    [clusterId]
  );

  if (!cluster) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  const [listings, buyers, proposalTiers, geography, toolHeatmap, overlapListings, budgetStats, jobTierDist, durationDist, categoryDist, paymentVerification, barrierToEntry, clusterDates] = await Promise.all([
    // Listings with proposal tier and skills
    query(
      `SELECT l.*, l.skills,
        l.raw_data->'_meta'->>'proposalsTier' AS proposal_tier,
        l.raw_data->'_meta'->>'tier' AS job_tier,
        l.raw_data->'_meta'->>'duration' AS engagement_duration,
        (l.raw_data->'_meta'->>'connectPrice')::int AS connect_price,
        (l.raw_data->'_meta'->>'paymentVerified')::boolean AS payment_verified,
        (l.raw_data->'_meta'->>'enterprise')::boolean AS is_enterprise,
        (l.raw_data->'_meta'->>'premium')::boolean AS is_premium
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1
       ORDER BY l.captured_at DESC`,
      [clusterId]
    ),

    // Buyers enriched with repeat count, LTV, and total clusters
    query(
      `SELECT DISTINCT ON (b.id) b.*,
        (SELECT COUNT(*) FROM listings l2
         JOIN listing_clusters lc2 ON lc2.listing_id = l2.id
         WHERE l2.buyer_id = b.id AND lc2.cluster_id = $1) AS listings_in_cluster,
        (SELECT COUNT(DISTINCT lc3.cluster_id) FROM listings l3
         JOIN listing_clusters lc3 ON lc3.listing_id = l3.id
         WHERE l3.buyer_id = b.id) AS total_clusters,
        CASE
          WHEN b.total_spent LIKE '$1M%' THEN 1000000
          WHEN b.total_spent LIKE '$500K%' THEN 500000
          WHEN b.total_spent LIKE '$100K%' THEN 100000
          WHEN b.total_spent LIKE '$50K%' THEN 50000
          WHEN b.total_spent LIKE '$10K%' THEN 10000
          WHEN b.total_spent LIKE '$5K%' THEN 5000
          WHEN b.total_spent LIKE '$1K%' THEN 1000
          ELSE 0
        END AS total_spent_numeric,
        CASE
          WHEN b.hire_rate IS NOT NULL THEN
            ROUND((b.hire_rate *
              CASE WHEN b.total_spent LIKE '$1M%' THEN 10000
                   WHEN b.total_spent LIKE '$500K%' THEN 5000
                   WHEN b.total_spent LIKE '$100K%' THEN 1000
                   WHEN b.total_spent LIKE '$50K%' THEN 500
                   WHEN b.total_spent LIKE '$10K%' THEN 100
                   WHEN b.total_spent LIKE '$5K%' THEN 50
                   WHEN b.total_spent LIKE '$1K%' THEN 10
                   ELSE 0
              END)::numeric, 0)
          ELSE NULL
        END AS buyer_quality_score
       FROM buyers b
       JOIN listings l ON l.buyer_id = b.id
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1`,
      [clusterId]
    ),

    // Proposal tier distribution
    query(
      `SELECT l.raw_data->'_meta'->>'proposalsTier' AS proposal_tier, COUNT(*) AS count
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1 AND l.raw_data->'_meta'->>'proposalsTier' IS NOT NULL
       GROUP BY l.raw_data->'_meta'->>'proposalsTier'
       ORDER BY count DESC`,
      [clusterId]
    ),

    // Geographic concentration
    query(
      `SELECT b.location, COUNT(DISTINCT b.id) AS buyer_count
       FROM buyers b
       JOIN listings l ON l.buyer_id = b.id
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1 AND b.location IS NOT NULL
       GROUP BY b.location
       ORDER BY buyer_count DESC
       LIMIT 5`,
      [clusterId]
    ),

    // Tool/stack heatmap
    query(
      `SELECT tool, COUNT(*) AS mention_count
       FROM (
         SELECT UNNEST(l.tools_mentioned) AS tool
         FROM listings l
         JOIN listing_clusters lc ON lc.listing_id = l.id
         WHERE lc.cluster_id = $1 AND l.tools_mentioned IS NOT NULL
       ) sub
       GROUP BY tool
       ORDER BY mention_count DESC
       LIMIT 15`,
      [clusterId]
    ),

    // Overlap listings (listings in this cluster that also appear in others)
    query(
      `SELECT l.id, l.title,
        ARRAY(
          SELECT c2.name FROM listing_clusters lc2
          JOIN clusters c2 ON c2.id = lc2.cluster_id
          WHERE lc2.listing_id = l.id AND lc2.cluster_id != $1
        ) AS other_clusters
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1
         AND (SELECT COUNT(DISTINCT lc2.cluster_id) FROM listing_clusters lc2 WHERE lc2.listing_id = l.id) > 1`,
      [clusterId]
    ),

    // Budget stats
    queryOne<{ budget_stddev: string; budget_avg: string; budget_floor: string; budget_ceiling: string }>(
      `SELECT
        ROUND(STDDEV(COALESCE(l.budget_max, l.budget_min, 0))::numeric, 0) AS budget_stddev,
        ROUND(AVG(COALESCE(l.budget_max, l.budget_min, 0))::numeric, 0) AS budget_avg,
        MIN(COALESCE(l.budget_min, l.budget_max)) AS budget_floor,
        MAX(COALESCE(l.budget_max, l.budget_min)) AS budget_ceiling
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1`,
      [clusterId]
    ),

    // Job tier distribution
    query(
      `SELECT l.raw_data->'_meta'->>'tier' AS job_tier, COUNT(*) AS count
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1 AND l.raw_data->'_meta'->>'tier' IS NOT NULL
       GROUP BY l.raw_data->'_meta'->>'tier'
       ORDER BY count DESC`,
      [clusterId]
    ),

    // Duration distribution
    query(
      `SELECT l.raw_data->'_meta'->>'duration' AS duration, COUNT(*) AS count
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1 AND l.raw_data->'_meta'->>'duration' IS NOT NULL
       GROUP BY l.raw_data->'_meta'->>'duration'
       ORDER BY count DESC`,
      [clusterId]
    ),

    // Category distribution
    query(
      `SELECT l.category, COUNT(*) AS count
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1 AND l.category IS NOT NULL
       GROUP BY l.category
       ORDER BY count DESC
       LIMIT 10`,
      [clusterId]
    ),

    // Payment verification
    queryOne<{ verified_count: string; total_with_data: string; verification_rate: string }>(
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
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1`,
      [clusterId]
    ),

    // Barrier to entry
    queryOne<{ avg_connect_price: string; min_connect_price: string; max_connect_price: string; enterprise_count: string; premium_count: string }>(
      `SELECT
        ROUND(AVG((l.raw_data->'_meta'->>'connectPrice')::numeric), 1) AS avg_connect_price,
        MIN((l.raw_data->'_meta'->>'connectPrice')::int) AS min_connect_price,
        MAX((l.raw_data->'_meta'->>'connectPrice')::int) AS max_connect_price,
        COUNT(*) FILTER (WHERE (l.raw_data->'_meta'->>'enterprise')::boolean = true) AS enterprise_count,
        COUNT(*) FILTER (WHERE (l.raw_data->'_meta'->>'premium')::boolean = true) AS premium_count
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1`,
      [clusterId]
    ),

    // Cluster dates
    queryOne<{ latest_listing_at: string; earliest_listing_at: string; latest_posted_at: string }>(
      `SELECT
        MAX(l.captured_at) AS latest_listing_at,
        MIN(l.captured_at) AS earliest_listing_at,
        MAX(l.posted_at) AS latest_posted_at
       FROM listings l
       JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE lc.cluster_id = $1`,
      [clusterId]
    ),
  ]);

  return NextResponse.json({
    cluster,
    listings,
    buyers,
    proposalTiers,
    geography,
    toolHeatmap,
    overlapListings,
    budgetStats,
    jobTierDist,
    durationDist,
    categoryDist,
    paymentVerification,
    barrierToEntry,
    clusterDates,
  });
}

// PATCH /api/clusters/:id — rename cluster
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clusterId = Number(id);
  const body = await req.json();

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (body.name != null) {
    updates.push(`name = $${idx++}`);
    values.push(body.name);
  }
  if (body.description != null) {
    updates.push(`description = $${idx++}`);
    values.push(body.description);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  updates.push("updated_at = now()");
  values.push(clusterId);

  const cluster = await queryOne(
    `UPDATE clusters SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  return NextResponse.json(cluster);
}

// POST /api/clusters/:id/merge — merge another cluster into this one
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const targetId = Number(id);
  const body = await req.json();
  const sourceId = Number(body.merge_from);

  if (!sourceId || sourceId === targetId) {
    return NextResponse.json({ error: "Invalid merge source" }, { status: 400 });
  }

  // Move all listings from source cluster to target
  // Use ON CONFLICT to skip listings already in target
  await query(
    `INSERT INTO listing_clusters (listing_id, cluster_id)
     SELECT listing_id, $1 FROM listing_clusters WHERE cluster_id = $2
     ON CONFLICT DO NOTHING`,
    [targetId, sourceId]
  );

  // Remove old associations and delete source cluster
  await query("DELETE FROM listing_clusters WHERE cluster_id = $1", [sourceId]);
  await query("DELETE FROM clusters WHERE id = $1", [sourceId]);

  // Recalc stats for target cluster
  const stats = await queryOne<{
    cnt: string;
    avg_b: string;
    score: string;
    velocity: string;
  }>(`
    SELECT
      COUNT(*) AS cnt,
      AVG(COALESCE(l.budget_max, l.budget_min, 0)) AS avg_b,
      COUNT(*) *
      COALESCE(AVG(COALESCE(l.budget_max, l.budget_min, 0)), 1) *
      AVG(CASE
        WHEN l.captured_at > now() - interval '7 days' THEN 1.0
        WHEN l.captured_at > now() - interval '30 days' THEN 0.7
        ELSE 0.4
      END) AS score,
      CASE
        WHEN COUNT(*) FILTER (WHERE l.captured_at BETWEEN now() - interval '28 days' AND now() - interval '14 days') = 0
        THEN COUNT(*) FILTER (WHERE l.captured_at > now() - interval '14 days')::numeric
        ELSE COUNT(*) FILTER (WHERE l.captured_at > now() - interval '14 days')::numeric /
             COUNT(*) FILTER (WHERE l.captured_at BETWEEN now() - interval '28 days' AND now() - interval '14 days')::numeric
      END AS velocity
    FROM listing_clusters lc
    JOIN listings l ON l.id = lc.listing_id
    WHERE lc.cluster_id = $1
  `, [targetId]);

  if (stats) {
    await query(
      `UPDATE clusters SET listing_count = $1, avg_budget = $2, heat_score = $3, velocity = $4, updated_at = now() WHERE id = $5`,
      [stats.cnt, stats.avg_b, stats.score, stats.velocity, targetId]
    );
  }

  const cluster = await queryOne("SELECT * FROM clusters WHERE id = $1", [targetId]);
  return NextResponse.json({ merged: true, cluster });
}
