export interface Listing {
  id: number;
  upwork_url: string | null;
  title: string;
  description: string | null;
  budget_type: "fixed" | "hourly" | null;
  budget_min: number | null;
  budget_max: number | null;
  skills: string[];
  category: string | null;
  posted_at: string | null;
  captured_at: string;
  raw_data: Record<string, any> | null;
  problem_category: string | null;
  vertical: string | null;
  workflow_described: string | null;
  tools_mentioned: string[] | null;
  budget_tier: "low" | "mid" | "high" | null;
  is_recurring_type_need: boolean | null;
  ai_processed_at: string | null;
  buyer_id: number | null;
}

export interface Buyer {
  id: number;
  upwork_client_name: string | null;
  company_name: string | null;
  upwork_profile_url: string | null;
  jobs_posted: number | null;
  total_spent: string | null;
  hire_rate: number | null;
  industry_vertical: string | null;
  company_size_indicator: string | null;
  location: string | null;
}

export interface Cluster {
  id: number;
  name: string;
  description: string | null;
  representative_listing_id: number | null;
  heat_score: number;
  listing_count: number;
  avg_budget: number | null;
  velocity: number;
  created_at: string;
  updated_at: string;
}

/** Payload the Chrome extension sends to POST /api/listings */
export interface CapturedListing {
  url?: string;
  title: string;
  description?: string;
  budgetType?: "fixed" | "hourly";
  budgetMin?: number;
  budgetMax?: number;
  skills?: string[];
  category?: string;
  postedAt?: string;
  client?: {
    name?: string;
    profileUrl?: string;
    jobsPosted?: number;
    totalSpent?: string;
    hireRate?: number;
    location?: string;
  };
}
