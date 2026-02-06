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
