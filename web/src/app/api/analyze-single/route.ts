import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { extractListing } from "@/lib/ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, skills, budgetMin, budgetMax, budgetType, url } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Return cached result if this URL was already analyzed
    if (url) {
      const cached = await queryOne<{
        id: number;
        pain_symptom: string | null;
        pain_root_cause: string | null;
        solution_pattern: string | null;
        saas_pitch: string | null;
      }>(
        `SELECT id, pain_symptom, pain_root_cause, solution_pattern, saas_pitch
         FROM listings WHERE upwork_url = $1 LIMIT 1`,
        [url]
      );
      if (cached && cached.pain_symptom != null && cached.saas_pitch != null) {
        return NextResponse.json(
          {
            listing_id: cached.id,
            pain_symptom: cached.pain_symptom,
            pain_root_cause: cached.pain_root_cause,
            solution_pattern: cached.solution_pattern,
            saas_pitch: cached.saas_pitch,
            cached: true,
          },
          { headers: corsHeaders }
        );
      }
    }

    // Run AI extraction
    const { result } = await extractListing(
      title,
      description ?? null,
      Array.isArray(skills) ? skills : [],
      typeof budgetMin === "number" ? budgetMin : null,
      typeof budgetMax === "number" ? budgetMax : null
    );

    const tierRaw = (result.budget_tier || "").toLowerCase();
    const budgetTier = tierRaw.includes("low")
      ? "low"
      : tierRaw.includes("high")
      ? "high"
      : "mid";

    // Upsert: insert fresh listing or overwrite AI fields on existing one
    const hasUrl = url != null && url !== "";
    const params = [
      hasUrl ? url : null,
      title,
      description ?? null,
      budgetType ?? null,
      typeof budgetMin === "number" ? budgetMin : null,
      typeof budgetMax === "number" ? budgetMax : null,
      Array.isArray(skills) ? skills : [],
      result.problem_category,
      result.vertical,
      result.workflow_described,
      result.tools_mentioned,
      budgetTier,
      result.is_recurring_type_need,
      result.confidence,
      JSON.stringify(result),
      result.pain_symptom ?? null,
      result.pain_root_cause ?? null,
      result.solution_specific ?? null,
      result.solution_pattern ?? null,
      result.saas_pitch ?? null,
    ];
    const row = await queryOne<{ id: number }>(
      hasUrl
        ? `INSERT INTO listings (
             upwork_url, title, description, budget_type, budget_min, budget_max, skills,
             source, problem_category, vertical, workflow_described, tools_mentioned,
             budget_tier, is_recurring_type_need, ai_confidence, ai_raw_extraction,
             pain_symptom, pain_root_cause, solution_specific, solution_pattern,
             saas_pitch, ai_processed_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7,
             'single', $8, $9, $10, $11,
             $12, $13, $14, $15,
             $16, $17, $18, $19,
             $20, now()
           )
           ON CONFLICT (upwork_url) DO UPDATE SET
             source               = 'single',
             problem_category     = EXCLUDED.problem_category,
             vertical             = EXCLUDED.vertical,
             workflow_described   = EXCLUDED.workflow_described,
             tools_mentioned      = EXCLUDED.tools_mentioned,
             budget_tier          = EXCLUDED.budget_tier,
             is_recurring_type_need = EXCLUDED.is_recurring_type_need,
             ai_confidence        = EXCLUDED.ai_confidence,
             ai_raw_extraction    = EXCLUDED.ai_raw_extraction,
             pain_symptom         = EXCLUDED.pain_symptom,
             pain_root_cause      = EXCLUDED.pain_root_cause,
             solution_specific    = EXCLUDED.solution_specific,
             solution_pattern     = EXCLUDED.solution_pattern,
             saas_pitch           = EXCLUDED.saas_pitch,
             ai_processed_at      = now()
           RETURNING id`
        : `INSERT INTO listings (
             upwork_url, title, description, budget_type, budget_min, budget_max, skills,
             source, problem_category, vertical, workflow_described, tools_mentioned,
             budget_tier, is_recurring_type_need, ai_confidence, ai_raw_extraction,
             pain_symptom, pain_root_cause, solution_specific, solution_pattern,
             saas_pitch, ai_processed_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7,
             'single', $8, $9, $10, $11,
             $12, $13, $14, $15,
             $16, $17, $18, $19,
             $20, now()
           )
           RETURNING id`,
      params
    );

    if (!row) {
      return NextResponse.json(
        { error: "Upsert returned no row" },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        listing_id: row.id,
        pain_symptom: result.pain_symptom,
        pain_root_cause: result.pain_root_cause,
        solution_pattern: result.solution_pattern,
        saas_pitch: result.saas_pitch,
        cached: false,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
