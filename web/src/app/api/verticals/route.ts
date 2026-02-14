import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/verticals — list verticals with stats
export async function GET() {
  const rows = await query(
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
     WHERE l.vertical IS NOT NULL AND l.ai_processed_at IS NOT NULL
     GROUP BY l.vertical
     ORDER BY COUNT(*) DESC`
  );

  return NextResponse.json(rows);
}
