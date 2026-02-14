import { query, queryOne } from "@/lib/db";
import { suggestCluster } from "@/lib/ai";
import { classifyApiError, finalizeRun, recalcHeatScores } from "../shared";

export async function POST(req: Request) {
  let listingIds: number[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body.listingIds)) {
      listingIds = body.listingIds.filter((id: any) => typeof id === "number" && Number.isInteger(id));
    }
  } catch {}

  if (listingIds.length === 0) {
    return new Response(
      `data: ${JSON.stringify({ type: "done", total: 0, succeeded: 0, failed: 0, message: "No listing IDs provided" })}\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }
    );
  }

  // Load extraction data for the given IDs
  const placeholders = listingIds.map((_, i) => `$${i + 1}`).join(",");
  const listings = await query<{
    id: number;
    title: string;
    problem_category: string | null;
    vertical: string | null;
    buyer_id: number | null;
  }>(
    `SELECT id, title, problem_category, vertical, buyer_id FROM listings WHERE id IN (${placeholders}) AND ai_processed_at IS NOT NULL AND ai_error IS NULL`,
    listingIds
  );

  const total = listings.length;

  if (total === 0) {
    return new Response(
      `data: ${JSON.stringify({ type: "done", total: 0, succeeded: 0, failed: 0, message: "No valid extracted listings found" })}\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }
    );
  }

  const run = await queryOne<{ id: number }>(
    `INSERT INTO processing_runs (listings_total, status) VALUES ($1, 'running') RETURNING id`,
    [total]
  );
  const runId = run!.id;

  const existingClusters = await query<{
    id: number;
    name: string;
    description: string | null;
  }>("SELECT id, name, description FROM clusters ORDER BY id");

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, any>) {
        try { controller.enqueue(`data: ${JSON.stringify(data)}\n\n`); } catch {}
      }

      send({ type: "start", total });

      let succeeded = 0;
      let failed = 0;
      let haikuIn = 0, haikuOut = 0;

      for (const listing of listings) {
        // Check abort
        if (req.signal.aborted) {
          const { totalIn, totalOut, costCents } = await finalizeRun(
            runId, "aborted", succeeded, failed, total,
            haikuIn, haikuOut, 0, 0, "Aborted by user"
          );
          send({
            type: "done",
            succeeded,
            failed,
            tokens: { input: totalIn, output: totalOut },
            costCents,
            runId,
            aborted: true,
          });
          controller.close();
          return;
        }

        try {
          send({
            type: "progress",
            current: succeeded + failed + 1,
            total,
            title: listing.title,
            step: "clustering",
          });

          const { result: suggestion, usage: clusterUsage } = await suggestCluster(
            listing.problem_category || "",
            listing.vertical || "",
            existingClusters
          );
          haikuIn += clusterUsage.input_tokens;
          haikuOut += clusterUsage.output_tokens;

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

          succeeded++;
          send({
            type: "item_done",
            current: succeeded + failed,
            total,
            title: listing.title,
            cluster: suggestion.cluster_name,
            status: "ok",
          });
        } catch (err: any) {
          const classified = classifyApiError(err);
          failed++;
          send({
            type: "item_done",
            current: succeeded + failed,
            total,
            title: listing.title,
            status: "error",
            error: classified.message,
            errorType: classified.errorType,
          });

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
              succeeded,
              failed,
              tokens: { input: totalIn, output: totalOut },
              costCents,
              runId,
            });
            await recalcHeatScores();
            controller.close();
            return;
          }
        }
      }

      const { totalIn, totalOut, costCents } = await finalizeRun(
        runId, "completed", succeeded, failed, total,
        haikuIn, haikuOut, 0, 0
      );

      await recalcHeatScores();
      send({
        type: "done",
        succeeded,
        failed,
        tokens: { input: totalIn, output: totalOut },
        costCents,
        runId,
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
