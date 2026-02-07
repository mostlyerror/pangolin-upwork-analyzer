import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export interface ExtractionResult {
  problem_category: string;
  vertical: string;
  workflow_described: string;
  tools_mentioned: string[];
  budget_tier: "low" | "mid" | "high";
  is_recurring_type_need: boolean;
  buyer_company_name: string | null;
  buyer_industry: string | null;
}

export async function extractListing(
  title: string,
  description: string | null,
  skills: string[],
  budgetMin: number | null,
  budgetMax: number | null
): Promise<ExtractionResult> {
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
  "buyer_industry": "buyer's industry if detectable, else null"
}`,
      },
    ],
  });

  const text =
    msg.content[0].type === "text" ? msg.content[0].text : "";

  // Extract JSON from response (handle markdown code fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`AI did not return valid JSON: ${text.slice(0, 200)}`);
  }

  return JSON.parse(jsonMatch[0]) as ExtractionResult;
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
): Promise<ClusterSuggestion> {
  const clusterList =
    existingClusters.length > 0
      ? existingClusters
          .map((c) => `  ID ${c.id}: "${c.name}" — ${c.description || "no description"}`)
          .join("\n")
      : "  (none yet)";

  const msg = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
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

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`AI did not return valid JSON: ${text.slice(0, 200)}`);
  }

  return JSON.parse(jsonMatch[0]) as ClusterSuggestion;
}
