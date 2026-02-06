import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { Cluster } from "@/types";

// GET /api/clusters — list clusters ranked by heat score
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);

  const rows = await query<Cluster>(
    `SELECT c.*,
            (SELECT title FROM listings WHERE id = c.representative_listing_id) AS representative_title
     FROM clusters c
     ORDER BY c.heat_score DESC
     LIMIT $1`,
    [limit]
  );

  return NextResponse.json(rows);
}
