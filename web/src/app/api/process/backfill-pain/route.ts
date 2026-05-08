import { query, queryOne } from "@/lib/db";
import { extractListingBatch, BATCH_SIZE, type BatchListingInput } from "@/lib/ai";
import { classifyApiError, computeCostCents, finalizeRun } from "../shared";

export async function POST(req: Request) {
  let limit = 20;
  try {
    const body = await req.json();
    if (body.limit && Number.isInteger(body.limit) && body.limit > 0) {
      limit = Math.min(body.limit, 500);
    }
  } catch {}

  const listings = await query<{
    id: number;
    title: string;
    description: string | null;
    skills: string[];
    budget_min: number | null;
    budget_max: number | null;
  }>(
    `SELECT id, title, description, skills, budget_min, budget_max
     FROM listings
     WHERE pain_symptom IS NULL AND ai_processed_at IS NOT NULL
     ORDER BY captured_at DESC
     LIMIT $1`,
    [limit]
  );

  if (listings.length === 0) {
    return Response.json({ message: "No listings need backfill", processed: 0, succeeded: 0, failed: 0, cost_cents: 0 });
  }

  const total = listings.length;
  const run = await queryOne<{ id: number }>(
    `INSERT INTO processing_runs (listings_total, status) VALUES ($1, 'running') RETURNING id`,
    [total]
  );
  const runId = run!.id;

  let succeeded = 0;
  let failed = 0;
  let totalIn = 0;
  let totalOut = 0;

  const batches: BatchListingInput[][] = [];
  for (let i = 0; i < listings.length; i += BATCH_SIZE) {
    batches.push(
      listings.slice(i, i + BATCH_SIZE).map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        skills: l.skills,
        budgetMin: l.budget_min,
        budgetMax: l.budget_max,
      }))
    );
  }

  for (const batch of batches) {
    try {
      const { results, usage } = await extractListingBatch(batch);
      totalIn += usage.input_tokens;
      totalOut += usage.output_tokens;

      for (const item of results) {
        if (item.result) {
          await query(
            `UPDATE listings SET
              pain_symptom = $1, pain_root_cause = $2,
              solution_specific = $3, solution_pattern = $4
             WHERE id = $5`,
            [
              item.result.pain_symptom ?? null,
              item.result.pain_root_cause ?? null,
              item.result.solution_specific ?? null,
              item.result.solution_pattern ?? null,
              item.id,
            ]
          );
          succeeded++;
        } else {
          failed++;
        }
      }
    } catch (err: any) {
      const classified = classifyApiError(err);
      failed += batch.length;
      if (classified.fatal) {
        await finalizeRun(runId, "aborted", succeeded, failed, total, totalIn, totalOut, 0, 0, classified.message);
        return Response.json({ error: classified.message, processed: succeeded + failed, succeeded, failed, cost_cents: computeCostCents(totalIn, totalOut, 0, 0) }, { status: 500 });
      }
    }
  }

  const { costCents } = await finalizeRun(runId, "completed", succeeded, failed, total, totalIn, totalOut, 0, 0);

  return Response.json({ processed: total, succeeded, failed, cost_cents: costCents, run_id: runId });
}
