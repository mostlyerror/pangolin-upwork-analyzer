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
      `data: ${JSON.stringify({ type: "done", total: 0, results: [], tokens: { input: 0, output: 0 }, costCents: 0, succeeded: 0, failed: 0, message: "No unprocessed listings" })}\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }
    );
  }

  const run = await queryOne<{ id: number }>(
    `INSERT INTO processing_runs (listings_total, status) VALUES ($1, 'running') RETURNING id`,
    [total]
  );
  const runId = run!.id;

  const estimatedCostCents = Math.ceil(total * 0.1); // ~$0.001 per listing extraction

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, any>) {
        try { controller.enqueue(`data: ${JSON.stringify(data)}\n\n`); } catch {}
      }

      send({ type: "start", total, estimatedCostCents });

      let succeeded = 0;
      let failed = 0;
      let haikuIn = 0, haikuOut = 0;
      const allResults: any[] = [];

      // Split into batches of BATCH_SIZE
      const batches: BatchListingInput[][] = [];
      for (let i = 0; i < unprocessed.length; i += BATCH_SIZE) {
        batches.push(
          unprocessed.slice(i, i + BATCH_SIZE).map((l) => ({
            id: l.id,
            title: l.title,
            description: l.description,
            skills: l.skills,
            budgetMin: l.budget_min,
            budgetMax: l.budget_max,
          }))
        );
      }

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        // Check abort
        if (req.signal.aborted) {
          const { totalIn, totalOut, costCents } = await finalizeRun(
            runId, "aborted", succeeded, failed, total,
            haikuIn, haikuOut, 0, 0, "Aborted by user"
          );
          send({
            type: "done",
            results: allResults,
            tokens: { input: totalIn, output: totalOut },
            costCents,
            runId,
            succeeded,
            failed,
            aborted: true,
          });
          controller.close();
          return;
        }

        const batch = batches[batchIdx];
        send({ type: "batch_start", batchIndex: batchIdx, batchSize: batch.length });

        try {
          const { results, usage, rawText: batchRawText } = await extractListingBatch(batch);
          haikuIn += usage.input_tokens;
          haikuOut += usage.output_tokens;

          const batchItems: any[] = [];

          for (const item of results) {
            const listing = unprocessed.find((l) => l.id === item.id)!;
            if (item.result) {
              const tierRaw = (item.result.budget_tier || "").toLowerCase();
              const budgetTier = tierRaw.includes("low") ? "low" : tierRaw.includes("high") ? "high" : "mid";

              await query(
                `UPDATE listings SET
                  problem_category = $1, vertical = $2, workflow_described = $3,
                  tools_mentioned = $4, budget_tier = $5, is_recurring_type_need = $6,
                  ai_processed_at = now(), ai_error = NULL,
                  ai_raw_extraction = $8, ai_confidence = $9
                WHERE id = $7`,
                [
                  item.result.problem_category,
                  item.result.vertical,
                  item.result.workflow_described,
                  item.result.tools_mentioned,
                  budgetTier,
                  item.result.is_recurring_type_need,
                  item.id,
                  JSON.stringify(item.result),
                  item.result.confidence,
                ]
              );

              if (listing.buyer_id && (item.result.buyer_company_name || item.result.buyer_industry)) {
                await query(
                  `UPDATE buyers SET
                    company_name = COALESCE($1, company_name),
                    industry_vertical = COALESCE($2, industry_vertical),
                    updated_at = now()
                  WHERE id = $3`,
                  [item.result.buyer_company_name, item.result.buyer_industry, listing.buyer_id]
                );
              }

              succeeded++;
              batchItems.push({
                id: item.id,
                title: listing.title,
                status: "ok",
                extraction: {
                  problem_category: item.result.problem_category,
                  vertical: item.result.vertical,
                  workflow_described: item.result.workflow_described,
                  tools_mentioned: item.result.tools_mentioned,
                  budget_tier: budgetTier,
                  is_recurring_type_need: item.result.is_recurring_type_need,
                },
              });
              allResults.push({
                id: item.id,
                title: listing.title,
                problem_category: item.result.problem_category,
                vertical: item.result.vertical,
                workflow_described: item.result.workflow_described,
                tools_mentioned: item.result.tools_mentioned,
                budget_tier: budgetTier,
                is_recurring_type_need: item.result.is_recurring_type_need,
              });
            } else {
              await query(
                `UPDATE listings SET ai_processed_at = now(), ai_error = $1 WHERE id = $2`,
                [item.error, item.id]
              ).catch(() => {});

              failed++;
              batchItems.push({ id: item.id, title: listing.title, status: "error", error: item.error });
              allResults.push({ id: item.id, title: listing.title, status: "error", error: item.error });
            }
          }

          const costSoFarCents = computeCostCents(haikuIn, haikuOut, 0, 0);
          send({
            type: "batch_done",
            batchIndex: batchIdx,
            items: batchItems,
            tokens: { input: usage.input_tokens, output: usage.output_tokens },
            costSoFarCents,
          });
        } catch (err: any) {
          const classified = classifyApiError(err);

          // Mark remaining items in this batch as errors
          for (const l of batch) {
            const listing = unprocessed.find((u) => u.id === l.id)!;
            await query(
              `UPDATE listings SET ai_processed_at = now(), ai_error = $1 WHERE id = $2`,
              [classified.message, l.id]
            ).catch(() => {});
            failed++;
            allResults.push({ id: l.id, title: listing.title, status: "error", error: classified.message });
          }

          if (classified.fatal) {
            const { totalIn, totalOut, costCents } = await finalizeRun(
              runId, "aborted", succeeded, failed, total,
              haikuIn, haikuOut, 0, 0, classified.message
            );
            send({
              type: "fatal_error",
              errorType: classified.errorType,
              message: classified.message,
              processed: succeeded + failed,
              skipped: total - succeeded - failed,
            });
            send({
              type: "done",
              results: allResults,
              tokens: { input: totalIn, output: totalOut },
              costCents,
              runId,
              succeeded,
              failed,
            });
            controller.close();
            return;
          }
        }
      }

      const { totalIn, totalOut, costCents } = await finalizeRun(
        runId, "completed", succeeded, failed, total,
        haikuIn, haikuOut, 0, 0
      );

      send({
        type: "done",
        results: allResults,
        tokens: { input: totalIn, output: totalOut },
        costCents,
        runId,
        succeeded,
        failed,
      });
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
