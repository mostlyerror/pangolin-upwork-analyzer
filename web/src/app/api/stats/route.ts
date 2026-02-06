import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export async function GET() {
  const row = await queryOne<{
    total: string;
    unprocessed: string;
    processed: string;
  }>(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE ai_processed_at IS NULL) AS unprocessed,
      COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL) AS processed
    FROM listings
  `);

  return NextResponse.json({
    total: Number(row?.total ?? 0),
    unprocessed: Number(row?.unprocessed ?? 0),
    processed: Number(row?.processed ?? 0),
  });
}
