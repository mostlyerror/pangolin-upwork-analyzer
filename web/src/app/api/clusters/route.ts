import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/clusters — list clusters ranked by heat score with breakdown
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);

  const rows = await query(
    `SELECT
      c.*,
      (SELECT title FROM listings WHERE id = c.representative_listing_id) AS representative_title,
      breakdown.recency_factor,
      breakdown.listings_this_week,
      breakdown.listings_this_month,
      breakdown.listings_older,
      breakdown.budget_min,
      breakdown.budget_max,
      breakdown.buyer_count
    FROM clusters c
    LEFT JOIN LATERAL (
      SELECT
        AVG(CASE
          WHEN l.captured_at > now() - interval '7 days' THEN 1.0
          WHEN l.captured_at > now() - interval '30 days' THEN 0.7
          ELSE 0.4
        END) AS recency_factor,
        COUNT(*) FILTER (WHERE l.captured_at > now() - interval '7 days') AS listings_this_week,
        COUNT(*) FILTER (WHERE l.captured_at BETWEEN now() - interval '30 days' AND now() - interval '7 days') AS listings_this_month,
        COUNT(*) FILTER (WHERE l.captured_at < now() - interval '30 days') AS listings_older,
        MIN(COALESCE(l.budget_min, l.budget_max)) AS budget_min,
        MAX(COALESCE(l.budget_max, l.budget_min)) AS budget_max,
        COUNT(DISTINCT l.buyer_id) FILTER (WHERE l.buyer_id IS NOT NULL) AS buyer_count
      FROM listing_clusters lc
      JOIN listings l ON l.id = lc.listing_id
      WHERE lc.cluster_id = c.id
    ) breakdown ON true
    ORDER BY c.heat_score DESC
    LIMIT $1`,
    [limit]
  );

  return NextResponse.json(rows);
}
