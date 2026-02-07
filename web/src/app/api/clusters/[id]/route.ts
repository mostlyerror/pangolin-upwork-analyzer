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

  const listings = await query<Listing>(
    `SELECT l.* FROM listings l
     JOIN listing_clusters lc ON lc.listing_id = l.id
     WHERE lc.cluster_id = $1
     ORDER BY l.captured_at DESC`,
    [clusterId]
  );

  const buyers = await query(
    `SELECT DISTINCT b.* FROM buyers b
     JOIN listings l ON l.buyer_id = b.id
     JOIN listing_clusters lc ON lc.listing_id = l.id
     WHERE lc.cluster_id = $1`,
    [clusterId]
  );

  return NextResponse.json({ cluster, listings, buyers });
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
