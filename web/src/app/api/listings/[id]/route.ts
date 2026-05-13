import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import type { Listing } from "@/types";

const VALID_STATUSES = ["inbox", "archived", "promoted"] as const;
type ReviewStatus = (typeof VALID_STATUSES)[number];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const row = await queryOne<Listing>(
    "SELECT * FROM listings WHERE id = $1",
    [numId]
  );

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body: unknown = await req.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("review_status" in body) ||
      !VALID_STATUSES.includes((body as Record<string, unknown>).review_status as ReviewStatus)
    ) {
      return NextResponse.json(
        { error: "review_status must be one of: inbox, archived, promoted" },
        { status: 400 }
      );
    }

    const review_status = (body as { review_status: ReviewStatus }).review_status;

    const row = await queryOne<{ id: number }>(
      "UPDATE listings SET review_status = $1 WHERE id = $2 RETURNING id",
      [review_status, numId]
    );

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
