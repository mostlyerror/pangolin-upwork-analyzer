export interface Cluster {
  id: number;
  name: string;
  description: string | null;
  heat_score: number;
  listing_count: number;
  avg_budget: number | null;
  velocity: number;
  representative_title?: string;
  top_verticals?: string[];
  recency_factor: number | null;
  listings_this_week: number;
  listings_last_week: number;
  listings_this_month: number;
  listings_older: number;
  budget_min: number | null;
  budget_max: number | null;
  buyer_count: number;
  budget_stddev: number | null;
  latest_listing_at: string | null;
  avg_connect_price: number | null;
  verified_payment_count: number;
  payment_data_count: number;
}

export interface Listing {
  id: number;
  title: string;
  description: string | null;
  upwork_url: string | null;
  budget_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  problem_category: string | null;
  vertical: string | null;
  tools_mentioned: string[] | null;
  skills: string[] | null;
  captured_at: string;
  proposal_tier: string | null;
  job_tier: string | null;
  engagement_duration: string | null;
  connect_price: number | null;
  payment_verified: boolean | null;
  is_enterprise: boolean | null;
  is_premium: boolean | null;
  category: string | null;
  posted_at: string | null;
  workflow_described: string | null;
  is_recurring_type_need: boolean | null;
  ai_confidence: number | null;
  ai_raw_extraction: string | null;
}

export interface Buyer {
  id: number;
  upwork_client_name: string | null;
  company_name: string | null;
  total_spent: string | null;
  location: string | null;
  industry_vertical: string | null;
  listings_in_cluster: number | string | null;
  total_clusters: number | string | null;
  total_spent_numeric: number | string | null;
  hire_rate: number | null;
  jobs_posted: number | null;
  company_size_indicator: string | null;
  upwork_profile_url: string | null;
  buyer_quality_score: number | null;
}

export interface ClusterInfo {
  id: number;
  name: string;
  description: string | null;
  heat_score: number;
  listing_count: number;
  avg_budget: number | null;
  velocity: number;
  ai_interpretation: string | null;
  ai_interpretation_at: string | null;
  product_brief: string | null;
  product_brief_at: string | null;
}

export interface ProposalTier {
  proposal_tier: string;
  count: string;
}

export interface GeoEntry {
  location: string;
  buyer_count: string;
  listing_count?: string;
}

export interface ToolEntry {
  tool: string;
  mention_count: string;
}

export interface OverlapListing {
  id: number;
  title: string;
  other_clusters: string[];
}

export interface BudgetStats {
  budget_stddev: string;
  budget_avg: string;
  budget_floor: string;
  budget_ceiling: string;
}

export interface JobTierEntry {
  job_tier: string;
  count: string;
}

export interface DurationEntry {
  duration: string;
  count: string;
}

export interface CategoryEntry {
  category: string;
  count: string;
  avg_budget?: string;
}

export interface PaymentVerification {
  verified_count: string;
  total_with_data: string;
  verification_rate: string | null;
}

export interface BarrierToEntry {
  avg_connect_price: string | null;
  min_connect_price: string | null;
  max_connect_price: string | null;
  enterprise_count: string;
  premium_count: string;
}

export interface ClusterDates {
  latest_listing_at: string | null;
  earliest_listing_at: string | null;
  latest_posted_at: string | null;
}

export interface ClusterDetail {
  cluster: ClusterInfo;
  listings: Listing[];
  buyers: Buyer[];
  proposalTiers: ProposalTier[];
  geography: GeoEntry[];
  toolHeatmap: ToolEntry[];
  overlapListings: OverlapListing[];
  budgetStats: BudgetStats | null;
  jobTierDist: JobTierEntry[];
  durationDist: DurationEntry[];
  categoryDist: CategoryEntry[];
  paymentVerification: PaymentVerification | null;
  barrierToEntry: BarrierToEntry | null;
  clusterDates: ClusterDates | null;
}

export interface Vertical {
  vertical: string;
  count: string;
  avg_budget: string;
  buyer_count: string;
  total_budget: string;
}

export interface ProblemCategory {
  problem_category: string;
  count: string;
  avg_budget: string;
  buyer_count: string;
  verticals: string[];
}

export interface RecurringProblems {
  recurring: string;
  one_off: string;
  recurring_avg_budget: string;
  one_off_avg_budget: string;
}

export interface BudgetTier {
  budget_tier: string;
  count: string;
}

export interface VerticalBudget {
  vertical: string;
  avg_budget: string;
  total_budget: string;
  count: string;
}

export interface SeasonalityEntry {
  month: string;
  count: string;
  avg_budget: string;
}

export interface GlobalToolEntry {
  tool: string;
  mention_count: string;
}

export interface TrendsData {
  verticals: Vertical[];
  problemCategories: ProblemCategory[];
  recurringProblems: RecurringProblems | null;
  budgetTiers: BudgetTier[];
  verticalBudgets: VerticalBudget[];
  seasonality?: SeasonalityEntry[];
  globalGeography?: GeoEntry[];
  globalTools?: GlobalToolEntry[];
  globalJobTiers?: JobTierEntry[];
  globalDurations?: DurationEntry[];
  globalCategories?: CategoryEntry[];
  globalPaymentVerification?: PaymentVerification;
  globalBarrierToEntry?: BarrierToEntry;
}

export interface StatsData {
  total: number;
  unprocessed: number;
  processed: number;
  multi_cluster_listings: number;
  payment_verified_count: number;
  payment_verified_total: number;
}

export type SortKey = "heat_score" | "velocity" | "listing_count" | "avg_budget";

export type SidebarMode = "clusters" | "niches";

export interface VerticalSummary {
  vertical: string;
  listing_count: string;
  avg_budget: string;
  total_budget: string;
  buyer_count: string;
  recurring_count: string;
  one_off_count: string;
  listings_this_week: string;
  listings_last_week: string;
}

export interface VerticalClusterOverlap {
  cluster_id: number;
  cluster_name: string;
  listing_count: string;
  avg_budget: string;
  heat_score: string;
}

export interface VerticalDetail {
  summary: VerticalSummary;
  clusterOverlaps: VerticalClusterOverlap[];
  topProblemCategories: { category: string; count: string; avg_budget: string }[];
  toolHeatmap: ToolEntry[];
  jobTierDist: JobTierEntry[];
  durationDist: DurationEntry[];
  geography: GeoEntry[];
  paymentVerification: PaymentVerification | null;
  barrierToEntry: BarrierToEntry | null;
  listings: Listing[];
}

export interface ProductBriefIdea {
  name: string;
  pain_point: string;
  demand_evidence: string;
  tools_involved: string[];
  target_vertical: string;
  monetization_hint: string;
}

export interface ProductBrief {
  market_summary: string;
  ideas: ProductBriefIdea[];
}

export interface CoherenceSignal {
  id: number;
  name: string;
  listing_count: number;
  distinct_verticals: number;
  verticals: string[];
  isBroad: boolean;
  isCatchAll: boolean;
}

export interface ExtractionGap {
  id: number;
  title: string;
  gapType: "missing_tools" | "generic_vertical";
  detectedTools?: string[];
  vertical?: string;
  skills?: string[];
}

export interface QualityReport {
  coherence: {
    broadClusters: CoherenceSignal[];
    catchAllClusters: CoherenceSignal[];
    avgListingCount: number;
  };
  extractionGaps: {
    missingTools: ExtractionGap[];
    genericVerticals: ExtractionGap[];
    totalGaps: number;
  };
}

export interface FeedbackStats {
  total: number;
  byType: Record<string, number>;
  disagreementByCluster: { id: number; name: string; negative: number; total: number; rate: number }[];
}
