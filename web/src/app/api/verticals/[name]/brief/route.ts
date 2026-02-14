import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { generateProductBrief } from "@/lib/ai";

// POST /api/verticals/[name]/brief — generate product brief for a vertical (not cached)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const vertical = decodeURIComponent(name);

  // Check this vertical exists and get summary
  const summary = await queryOne<{
    listing_count: string;
    avg_budget: string;
  }>(
    `SELECT COUNT(*) AS listing_count,
            ROUND(AVG(COALESCE(l.budget_max, l.budget_min, 0))::numeric, 0) AS avg_budget
     FROM listings l
     WHERE l.vertical = $1 AND l.ai_processed_at IS NOT NULL`,
    [vertical]
  );

  if (!summary || Number(summary.listing_count) === 0) {
    return NextResponse.json({ error: "Vertical not found or has no listings" }, { status: 404 });
  }

  // Fetch workflow data (limit 50 for verticals)
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
     WHERE l.vertical = $1 AND l.ai_processed_at IS NOT NULL
     ORDER BY l.captured_at DESC
     LIMIT 50`,
    [vertical]
  );

  if (workflows.length === 0) {
    return NextResponse.json({ error: "No processed listings for this vertical" }, { status: 400 });
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
      source_name: vertical,
      source_type: "vertical",
      listing_count: Number(summary.listing_count),
      avg_budget: summary.avg_budget != null ? Number(summary.avg_budget) : null,
    }
  );

  return NextResponse.json({
    brief: JSON.parse(brief),
    generated_at: new Date().toISOString(),
    usage,
  });
}
