-- Pangolin — Database Schema
-- Phase 1: Core Loop + foundation for Phase 2 buyer intelligence

-- Buyers (clients who post jobs on Upwork)
CREATE TABLE buyers (
    id              SERIAL PRIMARY KEY,
    upwork_client_name  TEXT,
    company_name        TEXT,
    upwork_profile_url  TEXT UNIQUE,
    jobs_posted         INTEGER,
    total_spent         TEXT,           -- e.g. "$50K+" as displayed on Upwork
    hire_rate           NUMERIC(5,2),   -- percentage
    industry_vertical   TEXT,
    company_size_indicator TEXT,        -- extracted from context clues
    location            TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Raw listings captured from Upwork
CREATE TABLE listings (
    id              SERIAL PRIMARY KEY,
    upwork_url      TEXT UNIQUE,
    title           TEXT NOT NULL,
    description     TEXT,
    budget_type     TEXT CHECK (budget_type IN ('fixed', 'hourly')),
    budget_min      NUMERIC(12,2),
    budget_max      NUMERIC(12,2),
    skills          TEXT[],             -- skill tags from the listing
    category        TEXT,
    posted_at       TIMESTAMPTZ,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_data        JSONB,              -- full captured payload from extension

    -- AI-extracted fields (NULL until processed)
    problem_category        TEXT,
    vertical                TEXT,
    workflow_described       TEXT,
    tools_mentioned         TEXT[],
    budget_tier             TEXT CHECK (budget_tier IN ('low', 'mid', 'high')),
    is_recurring_type_need  BOOLEAN,
    ai_processed_at         TIMESTAMPTZ,
    ai_error                TEXT,

    -- AI quality monitoring
    ai_raw_extraction       TEXT,
    ai_confidence           REAL,

    -- Buyer link
    buyer_id        INTEGER REFERENCES buyers(id) ON DELETE SET NULL,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Opportunity clusters (AI-grouped problem categories)
CREATE TABLE clusters (
    id                      SERIAL PRIMARY KEY,
    name                    TEXT NOT NULL,
    description             TEXT,
    representative_listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    heat_score              NUMERIC(10,2) DEFAULT 0,
    listing_count           INTEGER DEFAULT 0,
    avg_budget              NUMERIC(12,2),
    velocity                NUMERIC(10,2) DEFAULT 0, -- growth rate indicator
    ai_interpretation       TEXT,
    ai_interpretation_at    TIMESTAMPTZ,
    product_brief           TEXT,
    product_brief_at        TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many-to-many: listings can appear in multiple clusters
CREATE TABLE listing_clusters (
    listing_id  INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    cluster_id  INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    PRIMARY KEY (listing_id, cluster_id)
);

-- Buyer enrichment data (Phase 2, but table ready now)
CREATE TABLE enrichment_data (
    id              SERIAL PRIMARY KEY,
    buyer_id        INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    company_website TEXT,
    linkedin_url    TEXT,
    company_size    TEXT,
    employee_count  INTEGER,
    tech_stack      TEXT[],
    decision_maker_name     TEXT,
    decision_maker_linkedin TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    enriched_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Processing run history (tracks AI batch runs with token usage / cost)
CREATE TABLE processing_runs (
    id                     SERIAL PRIMARY KEY,
    started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at           TIMESTAMPTZ,
    listings_total         INTEGER NOT NULL DEFAULT 0,
    listings_succeeded     INTEGER NOT NULL DEFAULT 0,
    listings_failed        INTEGER NOT NULL DEFAULT 0,
    input_tokens           INTEGER NOT NULL DEFAULT 0,
    output_tokens          INTEGER NOT NULL DEFAULT 0,
    estimated_cost_cents   INTEGER NOT NULL DEFAULT 0,
    status                 TEXT NOT NULL DEFAULT 'running'
                           CHECK (status IN ('running', 'completed', 'aborted')),
    error_message          TEXT
);

-- Indexes
CREATE INDEX idx_processing_runs_started ON processing_runs(started_at DESC);
CREATE INDEX idx_listings_buyer_id ON listings(buyer_id);
CREATE INDEX idx_listings_ai_processed ON listings(ai_processed_at) WHERE ai_processed_at IS NULL;
CREATE INDEX idx_listings_captured_at ON listings(captured_at);
CREATE INDEX idx_listings_problem_category ON listings(problem_category);
CREATE INDEX idx_clusters_heat_score ON clusters(heat_score DESC);
CREATE INDEX idx_enrichment_buyer_id ON enrichment_data(buyer_id);
CREATE INDEX idx_enrichment_status ON enrichment_data(status) WHERE status != 'completed';
CREATE INDEX idx_listings_vertical ON listings(vertical) WHERE vertical IS NOT NULL;
CREATE INDEX idx_listings_ai_confidence ON listings(ai_confidence) WHERE ai_confidence IS NOT NULL;

-- Quality feedback for extraction & cluster monitoring
CREATE TABLE quality_feedback (
    id                   SERIAL PRIMARY KEY,
    listing_id           INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    cluster_id           INTEGER REFERENCES clusters(id) ON DELETE SET NULL,
    feedback_type        TEXT NOT NULL CHECK (feedback_type IN (
                           'extraction_correct','extraction_wrong',
                           'cluster_correct','cluster_wrong',
                           'reassign_cluster')),
    notes                TEXT,
    suggested_cluster_id INTEGER REFERENCES clusters(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quality_feedback_listing ON quality_feedback(listing_id);
CREATE INDEX idx_quality_feedback_cluster ON quality_feedback(cluster_id);
