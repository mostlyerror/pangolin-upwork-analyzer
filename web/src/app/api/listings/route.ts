import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import type { CapturedListing, Listing } from "@/types";

// GET /api/listings — list listings, optional filters
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const offset = Number(searchParams.get("offset")) || 0;
  const unprocessedOnly = searchParams.get("unprocessed") === "true";

  let sql = "SELECT * FROM listings";
  const params: any[] = [];

  if (unprocessedOnly) {
    sql += " WHERE ai_processed_at IS NULL";
  }

  sql += " ORDER BY captured_at DESC LIMIT $1 OFFSET $2";
  params.push(limit, offset);

  const rows = await query<Listing>(sql, params);
  return NextResponse.json(rows);
}

// POST /api/listings — receive captured listings from extension
export async function POST(req: NextRequest) {
  const body = await req.json();
  const listings: CapturedListing[] = Array.isArray(body) ? body : [body];

  const inserted: Listing[] = [];

  for (const l of listings) {
    // Upsert buyer if client info provided
    let buyerId: number | null = null;
    if (l.client?.profileUrl) {
      const buyer = await queryOne<{ id: number }>(
        `INSERT INTO buyers (upwork_client_name, upwork_profile_url, jobs_posted, total_spent, hire_rate, location)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (upwork_profile_url) DO UPDATE SET
           upwork_client_name = COALESCE(EXCLUDED.upwork_client_name, buyers.upwork_client_name),
           jobs_posted = COALESCE(EXCLUDED.jobs_posted, buyers.jobs_posted),
           total_spent = COALESCE(EXCLUDED.total_spent, buyers.total_spent),
           hire_rate = COALESCE(EXCLUDED.hire_rate, buyers.hire_rate),
           location = COALESCE(EXCLUDED.location, buyers.location),
           updated_at = now()
         RETURNING id`,
        [
          l.client.name ?? null,
          l.client.profileUrl,
          l.client.jobsPosted ?? null,
          l.client.totalSpent ?? null,
          l.client.hireRate ?? null,
          l.client.location ?? null,
        ]
      );
      buyerId = buyer?.id ?? null;
    }

    // Insert listing (skip duplicates by upwork_url)
    const row = await queryOne<Listing>(
      `INSERT INTO listings (upwork_url, title, description, budget_type, budget_min, budget_max, skills, category, posted_at, raw_data, buyer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (upwork_url) DO NOTHING
       RETURNING *`,
      [
        l.url ?? null,
        l.title,
        l.description ?? null,
        l.budgetType ?? null,
        l.budgetMin ?? null,
        l.budgetMax ?? null,
        l.skills ?? [],
        l.category ?? null,
        l.postedAt ?? null,
        JSON.stringify(l),
        buyerId,
      ]
    );

    if (row) inserted.push(row);
  }

  return NextResponse.json(
    { inserted: inserted.length, skipped: listings.length - inserted.length },
    { status: 201 }
  );
}
