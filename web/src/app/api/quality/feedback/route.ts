import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { recalcHeatScores } from "../../process/shared";

// POST /api/quality/feedback — submit feedback
export async function POST(req: Request) {
  const body = await req.json();
  const { listing_id, cluster_id, feedback_type, notes, suggested_cluster_id } = body;

  if (!listing_id || !feedback_type) {
    return NextResponse.json({ error: "listing_id and feedback_type are required" }, { status: 400 });
  }

  const valid = [
    "extraction_correct", "extraction_wrong",
    "cluster_correct", "cluster_wrong",
    "reassign_cluster",
  ];
  if (!valid.includes(feedback_type)) {
    return NextResponse.json({ error: "Invalid feedback_type" }, { status: 400 });
  }

  // Insert feedback
  const feedback = await queryOne(
    `INSERT INTO quality_feedback (listing_id, cluster_id, feedback_type, notes, suggested_cluster_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [listing_id, cluster_id ?? null, feedback_type, notes ?? null, suggested_cluster_id ?? null]
  );

  // If reassign_cluster and suggested_cluster_id, move the listing
  if (feedback_type === "reassign_cluster" && suggested_cluster_id && cluster_id) {
    // Remove from old cluster
    await query(
      `DELETE FROM listing_clusters WHERE listing_id = $1 AND cluster_id = $2`,
      [listing_id, cluster_id]
    );
    // Add to new cluster
    await query(
      `INSERT INTO listing_clusters (listing_id, cluster_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [listing_id, suggested_cluster_id]
    );
    // Recalc heat scores
    await recalcHeatScores();
  }

  return NextResponse.json(feedback);
}

// GET /api/quality/feedback — feedback stats
export async function GET() {
  const [totalRow, byTypeRows, disagreementRows] = await Promise.all([
    queryOne<{ total: string }>(`SELECT COUNT(*) AS total FROM quality_feedback`),

    query<{ feedback_type: string; count: string }>(
      `SELECT feedback_type, COUNT(*) AS count FROM quality_feedback GROUP BY feedback_type`
    ),

    query<{ id: number; name: string; negative: string; total: string }>(
      `SELECT
        c.id,
        c.name,
        COUNT(*) FILTER (WHERE qf.feedback_type IN ('extraction_wrong', 'cluster_wrong', 'reassign_cluster')) AS negative,
        COUNT(*) AS total
       FROM quality_feedback qf
       JOIN clusters c ON c.id = qf.cluster_id
       WHERE qf.cluster_id IS NOT NULL
       GROUP BY c.id, c.name
       ORDER BY COUNT(*) FILTER (WHERE qf.feedback_type IN ('extraction_wrong', 'cluster_wrong', 'reassign_cluster')) DESC
       LIMIT 20`
    ),
  ]);

  const total = Number(totalRow?.total ?? 0);
  const byType: Record<string, number> = {};
  for (const row of byTypeRows) {
    byType[row.feedback_type] = Number(row.count);
  }

  const disagreementByCluster = disagreementRows.map((r) => ({
    id: r.id,
    name: r.name,
    negative: Number(r.negative),
    total: Number(r.total),
    rate: Number(r.total) > 0 ? Math.round((Number(r.negative) / Number(r.total)) * 100) : 0,
  }));

  return NextResponse.json({ total, byType, disagreementByCluster });
}
