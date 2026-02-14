import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const KNOWN_TOOLS = [
  "salesforce", "hubspot", "zapier", "shopify", "wordpress", "woocommerce",
  "stripe", "quickbooks", "xero", "slack", "notion", "airtable", "monday",
  "asana", "trello", "jira", "confluence", "google sheets", "excel",
  "mailchimp", "klaviyo", "sendgrid", "twilio", "aws", "azure", "gcp",
  "firebase", "supabase", "postgresql", "mysql", "mongodb", "redis",
  "docker", "kubernetes", "terraform", "github", "gitlab", "bitbucket",
  "figma", "webflow", "bubble", "make", "power automate", "zoho",
  "pipedrive", "freshdesk", "zendesk", "intercom", "segment", "mixpanel",
  "amplitude", "tableau", "power bi", "looker", "datadog", "sentry",
  "clickup", "basecamp", "linear", "retool", "n8n",
];

const GENERIC_VERTICALS = [
  "technology", "general", "other", "business", "various", "multiple",
  "tech", "it", "software", "digital", "online",
];

// GET /api/quality — coherence + extraction gap report
export async function GET() {
  const [clusterCoherence, listingsForGaps] = await Promise.all([
    // Coherence: clusters with their vertical distribution
    query<{
      id: number;
      name: string;
      listing_count: string;
      distinct_verticals: string;
      verticals: string[];
    }>(`
      SELECT
        c.id,
        c.name,
        COUNT(l.id) AS listing_count,
        COUNT(DISTINCT l.vertical) FILTER (WHERE l.vertical IS NOT NULL) AS distinct_verticals,
        ARRAY_AGG(DISTINCT l.vertical) FILTER (WHERE l.vertical IS NOT NULL) AS verticals
      FROM clusters c
      JOIN listing_clusters lc ON lc.cluster_id = c.id
      JOIN listings l ON l.id = lc.listing_id
      WHERE l.ai_processed_at IS NOT NULL
      GROUP BY c.id, c.name
      ORDER BY COUNT(l.id) DESC
    `),

    // Listings for extraction gap analysis
    query<{
      id: number;
      title: string;
      description: string | null;
      tools_mentioned: string[] | null;
      vertical: string | null;
      skills: string[] | null;
    }>(`
      SELECT id, title, description, tools_mentioned, vertical, skills
      FROM listings
      WHERE ai_processed_at IS NOT NULL
    `),
  ]);

  // Compute coherence signals
  const avgListingCount =
    clusterCoherence.length > 0
      ? clusterCoherence.reduce((s, c) => s + Number(c.listing_count), 0) / clusterCoherence.length
      : 0;

  const coherenceSignals = clusterCoherence.map((c) => ({
    id: c.id,
    name: c.name,
    listing_count: Number(c.listing_count),
    distinct_verticals: Number(c.distinct_verticals),
    verticals: c.verticals ?? [],
    isBroad: Number(c.distinct_verticals) >= 4,
    isCatchAll: Number(c.listing_count) > 2 * avgListingCount,
  }));

  const broadClusters = coherenceSignals.filter((c) => c.isBroad);
  const catchAllClusters = coherenceSignals.filter((c) => c.isCatchAll);

  // Extraction gap analysis
  const missingTools: Array<{
    id: number;
    title: string;
    gapType: "missing_tools";
    detectedTools: string[];
  }> = [];
  const genericVerticals: Array<{
    id: number;
    title: string;
    gapType: "generic_vertical";
    vertical: string;
    skills: string[];
  }> = [];

  for (const l of listingsForGaps) {
    // Check for tools in description that weren't extracted
    const tools = l.tools_mentioned ?? [];
    if (tools.length === 0 && l.description) {
      const descLower = l.description.toLowerCase();
      const detected = KNOWN_TOOLS.filter((t) => descLower.includes(t.toLowerCase()));
      if (detected.length > 0) {
        missingTools.push({
          id: l.id,
          title: l.title,
          gapType: "missing_tools",
          detectedTools: detected,
        });
      }
    }

    // Check for generic vertical with specific skills
    if (l.vertical && GENERIC_VERTICALS.includes(l.vertical.toLowerCase())) {
      const skills = l.skills ?? [];
      if (skills.length >= 2) {
        genericVerticals.push({
          id: l.id,
          title: l.title,
          gapType: "generic_vertical",
          vertical: l.vertical,
          skills,
        });
      }
    }
  }

  return NextResponse.json({
    coherence: {
      broadClusters,
      catchAllClusters,
      avgListingCount: Math.round(avgListingCount * 10) / 10,
    },
    extractionGaps: {
      missingTools: missingTools.slice(0, 50),
      genericVerticals: genericVerticals.slice(0, 50),
      totalGaps: missingTools.length + genericVerticals.length,
    },
  });
}
