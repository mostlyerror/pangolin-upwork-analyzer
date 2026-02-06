import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { extractListing, suggestCluster } from "@/lib/ai";

// POST /api/process — run AI extraction + clustering on unprocessed listings
export async function POST() {
  const unprocessed = await query<{
    id: number;
    title: string;
    description: string | null;
    skills: string[];
    budget_min: number | null;
    budget_max: number | null;
    buyer_id: number | null;
  }>(
    "SELECT id, title, description, skills, budget_min, budget_max, buyer_id FROM listings WHERE ai_processed_at IS NULL ORDER BY captured_at LIMIT 10"
  );

  if (unprocessed.length === 0) {
    return NextResponse.json({ message: "No unprocessed listings", processed: 0 });
  }

  const existingClusters = await query<{
    id: number;
    name: string;
    description: string | null;
  }>("SELECT id, name, description FROM clusters ORDER BY id");

  const results = [];

  for (const listing of unprocessed) {
    try {
      // Step 1: Extract structured fields
      const extracted = await extractListing(
        listing.title,
        listing.description,
        listing.skills,
        listing.budget_min,
        listing.budget_max
      );

      // Step 2: Update listing with extracted fields
      // Normalize budget_tier — LLM might return "medium", "moderate", etc.
      const tierRaw = (extracted.budget_tier || "").toLowerCase();
      const budgetTier = tierRaw.includes("low")
        ? "low"
        : tierRaw.includes("high")
          ? "high"
          : "mid";

      await query(
        `UPDATE listings SET
          problem_category = $1,
          vertical = $2,
          workflow_described = $3,
          tools_mentioned = $4,
          budget_tier = $5,
          is_recurring_type_need = $6,
          ai_processed_at = now()
        WHERE id = $7`,
        [
          extracted.problem_category,
          extracted.vertical,
          extracted.workflow_described,
          extracted.tools_mentioned,
          budgetTier,
          extracted.is_recurring_type_need,
          listing.id,
        ]
      );

      // Step 2b: Update buyer info if AI found company details
      if (listing.buyer_id && (extracted.buyer_company_name || extracted.buyer_industry)) {
        await query(
          `UPDATE buyers SET
            company_name = COALESCE($1, company_name),
            industry_vertical = COALESCE($2, industry_vertical),
            updated_at = now()
          WHERE id = $3`,
          [extracted.buyer_company_name, extracted.buyer_industry, listing.buyer_id]
        );
      }

      // Step 3: Assign to cluster
      const suggestion = await suggestCluster(
        extracted.problem_category,
        extracted.vertical,
        existingClusters
      );

      let clusterId: number;

      if (suggestion.action === "existing" && suggestion.cluster_id) {
        clusterId = suggestion.cluster_id;
      } else {
        // Create new cluster
        const newCluster = await queryOne<{ id: number }>(
          `INSERT INTO clusters (name, description, representative_listing_id)
           VALUES ($1, $2, $3) RETURNING id`,
          [suggestion.cluster_name, suggestion.cluster_description, listing.id]
        );
        clusterId = newCluster!.id;
        // Add to our in-memory list so subsequent listings in this batch can join it
        existingClusters.push({
          id: clusterId,
          name: suggestion.cluster_name,
          description: suggestion.cluster_description,
        });
      }

      // Link listing to cluster
      await query(
        `INSERT INTO listing_clusters (listing_id, cluster_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [listing.id, clusterId]
      );

      results.push({ id: listing.id, status: "ok", cluster: suggestion.cluster_name });
    } catch (err: any) {
      results.push({ id: listing.id, status: "error", error: err.message });
    }
  }

  // Step 4: Recalculate heat scores for all affected clusters
  await recalcHeatScores();

  return NextResponse.json({ processed: results.length, results });
}

async function recalcHeatScores() {
  // Heat score = frequency × avg_budget × recency_weight
  // Recency: this week = 1.0, last month = 0.7, older = 0.4
  await query(`
    UPDATE clusters c SET
      listing_count = sub.cnt,
      avg_budget = sub.avg_b,
      heat_score = sub.score,
      velocity = sub.velocity,
      updated_at = now()
    FROM (
      SELECT
        lc.cluster_id,
        COUNT(*) AS cnt,
        AVG(COALESCE(l.budget_max, l.budget_min, 0)) AS avg_b,
        -- heat = count * avg_budget * recency_factor
        COUNT(*) *
        COALESCE(AVG(COALESCE(l.budget_max, l.budget_min, 0)), 1) *
        AVG(CASE
          WHEN l.captured_at > now() - interval '7 days' THEN 1.0
          WHEN l.captured_at > now() - interval '30 days' THEN 0.7
          ELSE 0.4
        END) AS score,
        -- velocity = count in last 14 days / count in previous 14 days (0 = no prior data)
        CASE
          WHEN COUNT(*) FILTER (WHERE l.captured_at BETWEEN now() - interval '28 days' AND now() - interval '14 days') = 0
          THEN COUNT(*) FILTER (WHERE l.captured_at > now() - interval '14 days')::numeric
          ELSE COUNT(*) FILTER (WHERE l.captured_at > now() - interval '14 days')::numeric /
               COUNT(*) FILTER (WHERE l.captured_at BETWEEN now() - interval '28 days' AND now() - interval '14 days')::numeric
        END AS velocity
      FROM listing_clusters lc
      JOIN listings l ON l.id = lc.listing_id
      GROUP BY lc.cluster_id
    ) sub
    WHERE c.id = sub.cluster_id
  `);
}
