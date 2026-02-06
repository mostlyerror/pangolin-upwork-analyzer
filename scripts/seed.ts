// Run with: npx tsx scripts/seed.ts
// Seeds the database with sample Upwork listings

import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

const pool = new Pool({
  connectionString: "postgresql://benjaminpoon@localhost:5432/pangolin",
});

interface SeedListing {
  title: string;
  description?: string;
  budgetType?: string;
  budgetMin?: number;
  budgetMax?: number;
  skills?: string[];
  category?: string;
  client?: {
    name?: string;
    totalSpent?: string;
    location?: string;
    profileUrl?: string;
  };
}

async function seed() {
  const raw = readFileSync(join(__dirname, "seed.json"), "utf-8");
  const listings: SeedListing[] = JSON.parse(raw);

  console.log(`Seeding ${listings.length} listings...`);

  for (const l of listings) {
    // Upsert buyer if client info present
    let buyerId: number | null = null;
    if (l.client?.name) {
      // Use client name as a pseudo-unique key for seed data
      const existing = await pool.query(
        "SELECT id FROM buyers WHERE upwork_client_name = $1",
        [l.client.name]
      );
      if (existing.rows.length > 0) {
        buyerId = existing.rows[0].id;
      } else {
        const result = await pool.query(
          `INSERT INTO buyers (upwork_client_name, total_spent, location)
           VALUES ($1, $2, $3) RETURNING id`,
          [l.client.name, l.client.totalSpent ?? null, l.client.location ?? null]
        );
        buyerId = result.rows[0].id;
      }
    }

    // Insert listing
    const existing = await pool.query(
      "SELECT id FROM listings WHERE title = $1",
      [l.title]
    );
    if (existing.rows.length > 0) {
      console.log(`  Skipping duplicate: ${l.title.slice(0, 50)}...`);
      continue;
    }

    await pool.query(
      `INSERT INTO listings (title, description, budget_type, budget_min, budget_max, skills, category, raw_data, buyer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        l.title,
        l.description ?? null,
        l.budgetType ?? null,
        l.budgetMin ?? null,
        l.budgetMax ?? null,
        l.skills ?? [],
        l.category ?? null,
        JSON.stringify(l),
        buyerId,
      ]
    );
    console.log(`  Inserted: ${l.title.slice(0, 60)}`);
  }

  const count = await pool.query("SELECT COUNT(*) FROM listings");
  console.log(`\nDone. ${count.rows[0].count} total listings in database.`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
