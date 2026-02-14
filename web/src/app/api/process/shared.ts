import { query } from "@/lib/db";

export function classifyApiError(err: any): { errorType: string; message: string; fatal: boolean } {
  const status = err?.status ?? err?.statusCode;
  if (status === 401) {
    return { errorType: "auth_error", message: "API key invalid — check your ANTHROPIC_API_KEY", fatal: true };
  }
  if (status === 429) {
    return { errorType: "rate_limit", message: "Rate limited — check your credit balance at console.anthropic.com", fatal: true };
  }
  return { errorType: "processing_error", message: err?.message ?? String(err), fatal: false };
}

export function computeCostCents(
  haikuIn: number, haikuOut: number,
  sonnetIn: number, sonnetOut: number,
): number {
  // Haiku: $1/M input, $5/M output; Sonnet: $3/M input, $15/M output
  // Result in cents: divide dollar microcents by 10_000
  return Math.ceil((haikuIn * 1 + haikuOut * 5 + sonnetIn * 3 + sonnetOut * 15) / 10_000);
}

export async function finalizeRun(
  runId: number,
  status: "completed" | "aborted",
  succeeded: number,
  failed: number,
  total: number,
  haikuIn: number, haikuOut: number,
  sonnetIn: number, sonnetOut: number,
  errorMessage?: string,
) {
  const totalIn = haikuIn + sonnetIn;
  const totalOut = haikuOut + sonnetOut;
  const costCents = computeCostCents(haikuIn, haikuOut, sonnetIn, sonnetOut);
  await query(
    `UPDATE processing_runs SET
      completed_at = now(), status = $1,
      listings_total = $2, listings_succeeded = $3, listings_failed = $4,
      input_tokens = $5, output_tokens = $6, estimated_cost_cents = $7,
      error_message = $8
    WHERE id = $9`,
    [status, total, succeeded, failed, totalIn, totalOut, costCents, errorMessage ?? null, runId]
  ).catch(() => {});
  return { totalIn, totalOut, costCents };
}

export async function recalcHeatScores() {
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
