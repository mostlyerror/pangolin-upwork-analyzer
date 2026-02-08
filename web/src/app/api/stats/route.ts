import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET() {
  const row = await queryOne<{
    total: string;
    unprocessed: string;
    processed: string;
    processed_today: string;
    processed_this_week: string;
    errors: string;
    new_clusters_this_week: string;
    existing_cluster_assignments_this_week: string;
  }>(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE ai_processed_at IS NULL) AS unprocessed,
      COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL) AS processed,
      COUNT(*) FILTER (WHERE ai_processed_at > now() - interval '24 hours') AS processed_today,
      COUNT(*) FILTER (WHERE ai_processed_at > now() - interval '7 days') AS processed_this_week,
      COUNT(*) FILTER (WHERE ai_error IS NOT NULL) AS errors
    FROM listings
  `);

  const clusterRow = await queryOne<{
    new_clusters_this_week: string;
    existing_cluster_assignments_this_week: string;
  }>(`
    SELECT
      COUNT(DISTINCT c.id) FILTER (WHERE c.created_at > now() - interval '7 days') AS new_clusters_this_week,
      COUNT(lc.listing_id) FILTER (
        WHERE lc.listing_id IN (
          SELECT id FROM listings WHERE ai_processed_at > now() - interval '7 days'
        )
        AND c.created_at <= now() - interval '7 days'
      ) AS existing_cluster_assignments_this_week
    FROM listing_clusters lc
    JOIN clusters c ON c.id = lc.cluster_id
  `);

  const recentRuns = await query<{
    id: number;
    started_at: string;
    completed_at: string | null;
    listings_total: number;
    listings_succeeded: number;
    listings_failed: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_cents: number;
    status: string;
  }>(
    `SELECT id, started_at, completed_at, listings_total, listings_succeeded,
            listings_failed, input_tokens, output_tokens, estimated_cost_cents, status
     FROM processing_runs
     ORDER BY started_at DESC
     LIMIT 10`
  );

  const costRow = await queryOne<{ total: string }>(`
    SELECT COALESCE(SUM(estimated_cost_cents), 0) AS total
    FROM processing_runs
    WHERE started_at > now() - interval '7 days'
  `);

  return NextResponse.json({
    total: Number(row?.total ?? 0),
    unprocessed: Number(row?.unprocessed ?? 0),
    processed: Number(row?.processed ?? 0),
    processed_today: Number(row?.processed_today ?? 0),
    processed_this_week: Number(row?.processed_this_week ?? 0),
    errors: Number(row?.errors ?? 0),
    new_clusters_this_week: Number(clusterRow?.new_clusters_this_week ?? 0),
    existing_cluster_assignments_this_week: Number(clusterRow?.existing_cluster_assignments_this_week ?? 0),
    recent_runs: recentRuns,
    total_cost_cents_this_week: Number(costRow?.total ?? 0),
  });
}
