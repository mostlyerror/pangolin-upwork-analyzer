import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

/** Extract a top-level JSON object from a string that may contain markdown fences or prose. */
function extractJsonObject(text: string): string {
  // Strip markdown code fences first
  const stripped = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "");

  // Find the first '{' and then walk forward matching braces
  const start = stripped.indexOf("{");
  if (start === -1) throw new Error(`No JSON object found: ${text.slice(0, 200)}`);

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") { depth--; if (depth === 0) return stripped.slice(start, i + 1); }
  }

  throw new Error(`Unterminated JSON object: ${text.slice(0, 200)}`);
}

/** Extract a top-level JSON array from a string. */
function extractJsonArray(text: string): string {
  const stripped = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "");

  const start = stripped.indexOf("[");
  if (start === -1) throw new Error(`No JSON array found: ${text.slice(0, 200)}`);

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[") depth++;
    if (ch === "]") { depth--; if (depth === 0) return stripped.slice(start, i + 1); }
  }

  throw new Error(`Unterminated JSON array: ${text.slice(0, 200)}`);
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface WithUsage<T> {
  result: T;
  usage: TokenUsage;
}

export interface ExtractionResult {
  problem_category: string;
  vertical: string;
  workflow_described: string;
  tools_mentioned: string[];
  budget_tier: "low" | "mid" | "high";
  is_recurring_type_need: boolean;
  buyer_company_name: string | null;
  buyer_industry: string | null;
  confidence: number;
}

export async function extractListing(
  title: string,
  description: string | null,
  skills: string[],
  budgetMin: number | null,
  budgetMax: number | null
): Promise<WithUsage<ExtractionResult> & { rawText: string }> {
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyze this Upwork job listing and extract structured fields.

Title: ${title}
Description: ${description || "(not provided)"}
Skills: ${skills.length > 0 ? skills.join(", ") : "(none listed)"}
Budget: ${budgetMin != null ? `$${budgetMin}` : "?"}${budgetMax != null && budgetMax !== budgetMin ? ` - $${budgetMax}` : ""}

Return ONLY valid JSON with these fields:
{
  "problem_category": "specific problem being solved, at the level of 'could this be one product?' — e.g. 'DocuSign-to-Salesforce sync for real estate agents' not just 'CRM integration'",
  "vertical": "industry/vertical (e.g. Real Estate, E-commerce, Healthcare)",
  "workflow_described": "the manual workflow or pain point described, one sentence",
  "tools_mentioned": ["list", "of", "tools", "and", "platforms"],
  "budget_tier": "low (<$500) | mid ($500-$5000) | high (>$5000)",
  "is_recurring_type_need": true/false (is this a problem many businesses would have?),
  "buyer_company_name": "company name if detectable, else null",
  "buyer_industry": "buyer's industry if detectable, else null",
  "confidence": 0.0-1.0 (1.0 = clear listing with explicit details, 0.7 = reasonable but some inference needed, 0.5 = ambiguous with significant interpretation, 0.3 = vague listing where you are mostly guessing)
}`,
      },
    ],
  });

  const text =
    msg.content[0].type === "text" ? msg.content[0].text : "";

  const parsed = JSON.parse(extractJsonObject(text));
  const result: ExtractionResult = {
    ...parsed,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
  };

  return {
    result,
    usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens },
    rawText: text,
  };
}

const BATCH_SIZE = 10;

export interface BatchListingInput {
  id: number;
  title: string;
  description: string | null;
  skills: string[];
  budgetMin: number | null;
  budgetMax: number | null;
}

export interface BatchExtractionItem {
  id: number;
  result?: ExtractionResult;
  error?: string;
}

export async function extractListingBatch(
  listings: BatchListingInput[]
): Promise<{ results: BatchExtractionItem[]; usage: TokenUsage; rawText: string }> {
  const listingsBlock = listings
    .map((l) => {
      const budget = `${l.budgetMin != null ? `$${l.budgetMin}` : "?"}${l.budgetMax != null && l.budgetMax !== l.budgetMin ? ` - $${l.budgetMax}` : ""}`;
      return `--- Listing ID: ${l.id} ---
Title: ${l.title}
Description: ${l.description || "(not provided)"}
Skills: ${l.skills.length > 0 ? l.skills.join(", ") : "(none listed)"}
Budget: ${budget}`;
    })
    .join("\n\n");

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300 * listings.length,
      messages: [
        {
          role: "user",
          content: `Analyze these ${listings.length} Upwork job listings and extract structured fields for each.

${listingsBlock}

Return ONLY a valid JSON array. Each element must have an "id" field matching the Listing ID, plus these fields:
{
  "id": <listing id>,
  "problem_category": "specific problem being solved, at the level of 'could this be one product?' — e.g. 'DocuSign-to-Salesforce sync for real estate agents' not just 'CRM integration'",
  "vertical": "industry/vertical (e.g. Real Estate, E-commerce, Healthcare)",
  "workflow_described": "the manual workflow or pain point described, one sentence",
  "tools_mentioned": ["list", "of", "tools", "and", "platforms"],
  "budget_tier": "low (<$500) | mid ($500-$5000) | high (>$5000)",
  "is_recurring_type_need": true/false,
  "buyer_company_name": "company name if detectable, else null",
  "buyer_industry": "buyer's industry if detectable, else null",
  "confidence": 0.0-1.0 (1.0 = clear listing with explicit details, 0.7 = reasonable but some inference needed, 0.5 = ambiguous with significant interpretation, 0.3 = vague listing where you are mostly guessing)
}`,
        },
      ],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const usage: TokenUsage = { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens };

    // Parse the JSON array from the response
    const parsed: any[] = JSON.parse(extractJsonArray(text));
    const resultsMap = new Map<number, any>();
    for (const item of parsed) {
      if (item && typeof item.id === "number") {
        resultsMap.set(item.id, item);
      }
    }

    const results: BatchExtractionItem[] = listings.map((l) => {
      const item = resultsMap.get(l.id);
      if (!item) {
        return { id: l.id, error: "Missing from batch response" };
      }
      try {
        const result: ExtractionResult = {
          problem_category: item.problem_category ?? "",
          vertical: item.vertical ?? "",
          workflow_described: item.workflow_described ?? "",
          tools_mentioned: Array.isArray(item.tools_mentioned) ? item.tools_mentioned : [],
          budget_tier: item.budget_tier ?? "mid",
          is_recurring_type_need: !!item.is_recurring_type_need,
          buyer_company_name: item.buyer_company_name ?? null,
          buyer_industry: item.buyer_industry ?? null,
          confidence: typeof item.confidence === "number" ? item.confidence : 0.5,
        };
        return { id: l.id, result };
      } catch {
        return { id: l.id, error: "Malformed extraction data" };
      }
    });

    return { results, usage, rawText: text };
  } catch (err: any) {
    // If the batch call itself fails (auth, rate limit, etc.), rethrow
    const status = err?.status ?? err?.statusCode;
    if (status === 401 || status === 429) throw err;

    // For other errors, fall back to individual extraction
    let totalIn = 0, totalOut = 0;
    const results: BatchExtractionItem[] = [];
    const rawTexts: string[] = [];
    for (const l of listings) {
      try {
        const { result, usage, rawText } = await extractListing(l.title, l.description, l.skills, l.budgetMin, l.budgetMax);
        totalIn += usage.input_tokens;
        totalOut += usage.output_tokens;
        results.push({ id: l.id, result });
        rawTexts.push(rawText);
      } catch (innerErr: any) {
        const innerStatus = innerErr?.status ?? innerErr?.statusCode;
        if (innerStatus === 401 || innerStatus === 429) throw innerErr;
        results.push({ id: l.id, error: innerErr?.message ?? String(innerErr) });
      }
    }
    return { results, usage: { input_tokens: totalIn, output_tokens: totalOut }, rawText: rawTexts.join("\n---\n") };
  }
}

export { BATCH_SIZE };

export interface ClusterStatsSummary {
  name: string;
  description: string | null;
  listing_count: number;
  avg_budget: number | null;
  heat_score: number;
  velocity: number;
  budget_floor: number | null;
  budget_ceiling: number | null;
  budget_stddev: number | null;
  buyer_count: number;
  top_locations: string[];
  repeat_buyer_pct: number | null;
  top_quality_scores: number[];
  payment_verification_rate: number | null;
  job_tier_dist: Record<string, number>;
  proposal_tier_dist: Record<string, number>;
  avg_connect_price: number | null;
  enterprise_count: number;
  premium_count: number;
  duration_dist: Record<string, number>;
  top_tools: string[];
  top_categories: string[];
  days_since_last_listing: number | null;
}

export async function interpretCluster(
  stats: ClusterStatsSummary
): Promise<WithUsage<string>> {
  const lines: string[] = [
    `Cluster: "${stats.name}"`,
    stats.description ? `Description: ${stats.description}` : null,
    `Listings: ${stats.listing_count} | Avg budget: ${stats.avg_budget != null ? `$${Math.round(stats.avg_budget)}` : "unknown"}`,
    `Heat score: ${stats.heat_score} | Velocity: ${stats.velocity}x`,
    stats.budget_floor != null && stats.budget_ceiling != null
      ? `Budget range: $${stats.budget_floor}–$${stats.budget_ceiling} (stddev: $${stats.budget_stddev ?? "?"})`
      : null,
    `Buyers: ${stats.buyer_count}`,
    stats.top_locations.length > 0 ? `Top locations: ${stats.top_locations.join(", ")}` : null,
    stats.repeat_buyer_pct != null ? `Repeat buyer %: ${stats.repeat_buyer_pct}%` : null,
    stats.top_quality_scores.length > 0 ? `Top buyer quality scores: ${stats.top_quality_scores.join(", ")}` : null,
    stats.payment_verification_rate != null ? `Payment verified: ${stats.payment_verification_rate}%` : null,
    Object.keys(stats.job_tier_dist).length > 0
      ? `Job tiers: ${Object.entries(stats.job_tier_dist).map(([k, v]) => `${k}: ${v}`).join(", ")}`
      : null,
    Object.keys(stats.proposal_tier_dist).length > 0
      ? `Proposal tiers: ${Object.entries(stats.proposal_tier_dist).map(([k, v]) => `${k}: ${v}`).join(", ")}`
      : null,
    stats.avg_connect_price != null ? `Avg connect price: ${stats.avg_connect_price}` : null,
    stats.enterprise_count > 0 || stats.premium_count > 0
      ? `Enterprise: ${stats.enterprise_count} | Premium: ${stats.premium_count}`
      : null,
    Object.keys(stats.duration_dist).length > 0
      ? `Engagement durations: ${Object.entries(stats.duration_dist).map(([k, v]) => `${k}: ${v}`).join(", ")}`
      : null,
    stats.top_tools.length > 0 ? `Top tools/tech: ${stats.top_tools.join(", ")}` : null,
    stats.top_categories.length > 0 ? `Top categories: ${stats.top_categories.join(", ")}` : null,
    stats.days_since_last_listing != null ? `Days since last listing: ${stats.days_since_last_listing}` : null,
  ].filter(Boolean) as string[];

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are an Upwork opportunity analyst. Given the following cluster statistics, write 3-4 sentences of plain-English interpretation covering:
1. What opportunity this cluster represents
2. Demand signals (heat, velocity, freshness, buyer quality)
3. Competitive landscape and barrier to entry
4. Actionable takeaway for a freelancer or agency

Be concise, specific, and data-driven. Reference actual numbers. No bullet points — just prose.

${lines.join("\n")}`,
      },
    ],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";

  return {
    result: text.trim(),
    usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens },
  };
}

export interface WorkflowInput {
  title: string;
  workflow_described: string | null;
  problem_category: string | null;
  tools_mentioned: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  is_recurring: boolean | null;
}

export interface ProductBriefMetadata {
  source_name: string;
  source_type: "cluster" | "vertical";
  listing_count: number;
  avg_budget: number | null;
}

export async function generateProductBrief(
  workflows: WorkflowInput[],
  metadata: ProductBriefMetadata
): Promise<WithUsage<string>> {
  const workflowBlock = workflows
    .slice(0, 50)
    .map((w, i) => {
      const budget = `${w.budget_min != null ? `$${w.budget_min}` : "?"}${w.budget_max != null && w.budget_max !== w.budget_min ? ` - $${w.budget_max}` : ""}`;
      return `--- #${i + 1} ---
Title: ${w.title}
Workflow: ${w.workflow_described || "(not described)"}
Problem: ${w.problem_category || "(unknown)"}
Tools: ${w.tools_mentioned?.join(", ") || "(none)"}
Budget: ${budget}
Recurring: ${w.is_recurring ? "yes" : "no"}`;
    })
    .join("\n\n");

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a product strategist analyzing freelance job listings to identify productizable opportunities.

Source: ${metadata.source_type === "cluster" ? "Cluster" : "Vertical"} "${metadata.source_name}"
Total listings: ${metadata.listing_count} | Avg budget: ${metadata.avg_budget != null ? `$${Math.round(metadata.avg_budget)}` : "unknown"}

Here are the workflow descriptions from these listings:

${workflowBlock}

Based on these workflows, generate 2-5 distinct product ideas. Return ONLY valid JSON:
{
  "market_summary": "2-3 sentences summarizing the market opportunity and common pain points",
  "ideas": [
    {
      "name": "Short product name",
      "pain_point": "The specific problem this solves",
      "demand_evidence": "Evidence from the listings (mention counts, budget ranges, recurring patterns)",
      "tools_involved": ["tool1", "tool2"],
      "target_vertical": "Primary industry this serves",
      "monetization_hint": "How to monetize (SaaS subscription, per-use fee, etc.)"
    }
  ]
}`,
      },
    ],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const jsonStr = extractJsonObject(text);
  JSON.parse(jsonStr); // validate

  return {
    result: jsonStr,
    usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens },
  };
}

export interface ClusterSuggestion {
  action: "existing" | "new";
  cluster_id?: number;
  cluster_name: string;
  cluster_description: string;
}

export async function suggestCluster(
  problemCategory: string,
  vertical: string,
  existingClusters: { id: number; name: string; description: string | null }[]
): Promise<WithUsage<ClusterSuggestion>> {
  const clusterList =
    existingClusters.length > 0
      ? existingClusters
          .map((c) => `  ID ${c.id}: "${c.name}" — ${c.description || "no description"}`)
          .join("\n")
      : "  (none yet)";

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `A job listing has been categorized as:
Problem: "${problemCategory}"
Vertical: "${vertical}"

Existing opportunity clusters:
${clusterList}

Should this listing join an existing cluster or start a new one?
Two listings belong in the same cluster if they represent the same *product opportunity* — someone could build one product/service to serve both.

Return ONLY valid JSON:
{
  "action": "existing" or "new",
  "cluster_id": <id if existing, omit if new>,
  "cluster_name": "short name for the cluster",
  "cluster_description": "one sentence describing the opportunity"
}`,
      },
    ],
  });

  const text =
    msg.content[0].type === "text" ? msg.content[0].text : "";

  return {
    result: JSON.parse(extractJsonObject(text)) as ClusterSuggestion,
    usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens },
  };
}
