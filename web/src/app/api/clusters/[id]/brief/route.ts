import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { generateProductBrief } from "@/lib/ai";

// POST /api/clusters/[id]/brief — generate + cache product brief for a cluster
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clusterId = Number(id);

  const cluster = await queryOne<{
    id: number;
    name: string;
    listing_count: number;
    avg_budget: number | null;
  }>("SELECT id, name, listing_count, avg_budget FROM clusters WHERE id = $1", [clusterId]);

  if (!cluster) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  // Fetch workflow data for all listings in this cluster
  const workflows = await query<{
    title: string;
    workflow_described: string | null;
    problem_category: string | null;
    tools_mentioned: string[] | null;
    budget_min: number | null;
    budget_max: number | null;
    is_recurring_type_need: boolean | null;
  }>(
    `SELECT l.title, l.workflow_described, l.problem_category, l.tools_mentioned,
            l.budget_min, l.budget_max, l.is_recurring_type_need
     FROM listings l
     JOIN listing_clusters lc ON lc.listing_id = l.id
     WHERE lc.cluster_id = $1
     ORDER BY l.captured_at DESC`,
    [clusterId]
  );

  if (workflows.length === 0) {
    return NextResponse.json({ error: "No listings in cluster" }, { status: 400 });
  }

  const { result: brief, usage } = await generateProductBrief(
    workflows.map((w) => ({
      title: w.title,
      workflow_described: w.workflow_described,
      problem_category: w.problem_category,
      tools_mentioned: w.tools_mentioned,
      budget_min: w.budget_min,
      budget_max: w.budget_max,
      is_recurring: w.is_recurring_type_need,
    })),
    {
      source_name: cluster.name,
      source_type: "cluster",
      listing_count: cluster.listing_count,
      avg_budget: cluster.avg_budget != null ? Number(cluster.avg_budget) : null,
    }
  );

  // Cache in DB
  await queryOne(
    `UPDATE clusters SET product_brief = $1, product_brief_at = now() WHERE id = $2 RETURNING id`,
    [brief, clusterId]
  );

  return NextResponse.json({
    brief: JSON.parse(brief),
    generated_at: new Date().toISOString(),
    usage,
  });
}
