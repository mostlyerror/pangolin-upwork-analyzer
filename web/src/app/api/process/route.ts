import { query, queryOne } from "@/lib/db";
import { extractListing, suggestCluster } from "@/lib/ai";

// POST /api/process — stream AI extraction + clustering progress
export async function POST(req: Request) {
  let limit = 20;
  try {
    const body = await req.json();
    if (body.limit && Number.isInteger(body.limit) && body.limit > 0) {
      limit = Math.min(body.limit, 500);
    }
  } catch {}

  const unprocessed = await query<{
    id: number;
    title: string;
    description: string | null;
    skills: string[];
    budget_min: number | null;
    budget_max: number | null;
    buyer_id: number | null;
  }>(
    "SELECT id, title, description, skills, budget_min, budget_max, buyer_id FROM listings WHERE ai_processed_at IS NULL ORDER BY captured_at LIMIT $1",
    [limit]
  );

  const total = unprocessed.length;

  if (total === 0) {
    return new Response(
      `data: ${JSON.stringify({ type: "done", processed: 0, message: "No unprocessed listings" })}\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }
    );
  }

  const existingClusters = await query<{
    id: number;
    name: string;
    description: string | null;
  }>("SELECT id, name, description FROM clusters ORDER BY id");

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, any>) {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      }

      send({ type: "start", total });

      let completed = 0;

      for (const listing of unprocessed) {
        try {
          send({
            type: "progress",
            current: completed + 1,
            total,
            title: listing.title,
            step: "extracting",
          });

          // Step 1: Extract
          const extracted = await extractListing(
            listing.title,
            listing.description,
            listing.skills,
            listing.budget_min,
            listing.budget_max
          );

          const tierRaw = (extracted.budget_tier || "").toLowerCase();
          const budgetTier = tierRaw.includes("low")
            ? "low"
            : tierRaw.includes("high")
              ? "high"
              : "mid";

          await query(
            `UPDATE listings SET
              problem_category = $1, vertical = $2, workflow_described = $3,
              tools_mentioned = $4, budget_tier = $5, is_recurring_type_need = $6,
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

          send({
            type: "progress",
            current: completed + 1,
            total,
            title: listing.title,
            step: "clustering",
          });

          // Step 2: Cluster
          const suggestion = await suggestCluster(
            extracted.problem_category,
            extracted.vertical,
            existingClusters
          );

          let clusterId: number;
          if (suggestion.action === "existing" && suggestion.cluster_id) {
            clusterId = suggestion.cluster_id;
          } else {
            const newCluster = await queryOne<{ id: number }>(
              `INSERT INTO clusters (name, description, representative_listing_id)
               VALUES ($1, $2, $3) RETURNING id`,
              [suggestion.cluster_name, suggestion.cluster_description, listing.id]
            );
            clusterId = newCluster!.id;
            existingClusters.push({
              id: clusterId,
              name: suggestion.cluster_name,
              description: suggestion.cluster_description,
            });
          }

          await query(
            `INSERT INTO listing_clusters (listing_id, cluster_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [listing.id, clusterId]
          );

          completed++;
          send({
            type: "item_done",
            current: completed,
            total,
            title: listing.title,
            cluster: suggestion.cluster_name,
            status: "ok",
          });
        } catch (err: any) {
          completed++;
          send({
            type: "item_done",
            current: completed,
            total,
            title: listing.title,
            status: "error",
            error: err.message,
          });
        }
      }

      // Recalc heat scores
      await recalcHeatScores();
      send({ type: "done", processed: completed });
      controller.close();
    },
  });

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function recalcHeatScores() {
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
        COUNT(*) *
        COALESCE(AVG(COALESCE(l.budget_max, l.budget_min, 0)), 1) *
        AVG(CASE
          WHEN l.captured_at > now() - interval '7 days' THEN 1.0
          WHEN l.captured_at > now() - interval '30 days' THEN 0.7
          ELSE 0.4
        END) AS score,
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
