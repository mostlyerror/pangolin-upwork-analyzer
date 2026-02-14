import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/quality/review-queue — low-confidence + negative-feedback listings
export async function GET() {
  const listings = await query(
    `SELECT DISTINCT ON (l.id)
      l.id, l.title, l.description, l.upwork_url,
      l.budget_type, l.budget_min, l.budget_max,
      l.problem_category, l.vertical, l.tools_mentioned, l.skills,
      l.captured_at, l.workflow_described, l.is_recurring_type_need,
      l.ai_confidence, l.ai_raw_extraction,
      l.raw_data->'_meta'->>'proposalsTier' AS proposal_tier,
      l.raw_data->'_meta'->>'tier' AS job_tier,
      l.raw_data->'_meta'->>'duration' AS engagement_duration,
      (l.raw_data->'_meta'->>'connectPrice')::int AS connect_price,
      (l.raw_data->'_meta'->>'paymentVerified')::boolean AS payment_verified,
      (l.raw_data->'_meta'->>'enterprise')::boolean AS is_enterprise,
      (l.raw_data->'_meta'->>'premium')::boolean AS is_premium
     FROM listings l
     LEFT JOIN quality_feedback qf ON qf.listing_id = l.id
     WHERE l.ai_processed_at IS NOT NULL
       AND (
         l.ai_confidence < 0.5
         OR qf.feedback_type IN ('extraction_wrong', 'cluster_wrong')
       )
     ORDER BY l.id, l.ai_confidence ASC NULLS LAST
     LIMIT 50`
  );

  return NextResponse.json(listings);
}
