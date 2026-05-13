-- Pangolin v2 — Seed Data
-- Realistic pre-processed ideas spanning verticals, scores, and statuses
-- Safe to run multiple times (ON CONFLICT DO NOTHING)

INSERT INTO ideas (
  upwork_url, title, description,
  source, vertical, tools_mentioned, skills, budget_type, budget_min, budget_max, budget_tier,
  is_recurring_type_need, buyer_location,
  pain_symptom, pain_root_cause, solution_specific, solution_pattern, saas_pitch,
  pain_clarity, solution_saas_fit, recurrence_potential, viability_score,
  status, ai_processed_at, posted_at
) VALUES

-- Score 10: AI email triage
('https://www.upwork.com/jobs/~seed001',
 'Build AI-powered email triage system for our support team',
 'Our support inbox gets 500+ emails/day. Reps spend 40% of their time just routing and categorizing tickets before they can even start helping customers. We need something that reads incoming emails and auto-tags, routes, and drafts initial responses.',
 'batch', 'Customer Service', ARRAY['Zendesk','Gmail','OpenAI'], ARRAY['Python','AI','Email Automation'],
 'fixed', 8000, 15000, 'high', true, 'United States',
 'Support team spends 40% of time triaging and routing emails instead of solving problems',
 'No intelligent inbox routing — every email hits a generic queue and requires manual classification',
 'AI classifier that reads emails, assigns category/priority, routes to correct agent, drafts a suggested first response',
 'AI Triage',
 'An AI-powered support inbox router that classifies incoming tickets by intent, urgency, and product area, then routes to the right queue and generates draft responses. Charged per seat — every support team above 3 people has this problem and no one has solved it elegantly for SMBs.',
 'acute', 'strong', 'infrastructure', 10, 'saved', now() - interval '3 days', now() - interval '4 days'),

-- Score 10: E-commerce returns analytics
('https://www.upwork.com/jobs/~seed002',
 'Returns analytics dashboard — understand why customers return products',
 'We process ~800 returns/month across Shopify. We have zero visibility into return reasons beyond what customers type in a free-text box. We need structured analytics: return rate by SKU, by cohort, trend over time, and correlation with review scores.',
 'batch', 'E-commerce', ARRAY['Shopify','Google Analytics','Klaviyo'], ARRAY['Analytics','Data Visualization','Shopify'],
 'fixed', 6000, 12000, 'high', true, 'United Kingdom',
 'Blind to return patterns — can''t tell which products have structural quality issues vs one-off problems',
 'Return data is unstructured free text sitting in Shopify with no aggregation or analysis layer',
 'Dashboard that ingests Shopify return data, categorizes reasons with NLP, surfaces SKU-level trends and correlations',
 'Analytics Dashboard',
 'A returns intelligence platform for e-commerce brands that turns unstructured return reason text into actionable product insights. Connect Shopify, categorize returns automatically, and surface which SKUs need redesign vs which just need better sizing guides. Could expand to any platform — returns analytics is a universal e-commerce pain.',
 'acute', 'strong', 'infrastructure', 10, 'saved', now() - interval '1 day', now() - interval '2 days'),

-- Score 10: Customer onboarding
('https://www.upwork.com/jobs/~seed003',
 'Customer onboarding checklist tool with progress tracking and nudges',
 'We sell B2B SaaS. Our onboarding is a mess of Notion docs, manual Slack messages, and spreadsheet tracking. ~30% of new customers never fully activate. We need a structured onboarding flow where we can see exactly where each customer is stuck and trigger automated follow-ups.',
 'batch', 'SaaS', ARRAY['Intercom','HubSpot','Notion'], ARRAY['SaaS','Customer Success','Automation'],
 'hourly', 80, 120, 'high', true, 'Canada',
 '30% of new customers never activate — onboarding is tracked manually in spreadsheets',
 'No structured onboarding system: each CSM improvises, progress is invisible, follow-ups are manual',
 'Onboarding checklist builder with per-customer progress tracking, automated nudges at stall points, CSM dashboard',
 'Workflow Automation',
 'A customer onboarding platform for B2B SaaS companies that replaces spreadsheet tracking with a structured milestone system. Each customer gets a tailored checklist, the CS team sees a live progress board, and the system auto-sends nudges when customers stall on a step. Every growing SaaS company hits this problem around $1M ARR.',
 'acute', 'strong', 'infrastructure', 10, 'saved', now() - interval '5 days', now() - interval '6 days'),

-- Score 9: HubSpot + Airtable sync
('https://www.upwork.com/jobs/~seed004',
 'Two-way sync between HubSpot CRM and Airtable project tracker',
 'Sales closes deals in HubSpot. Delivery team manages projects in Airtable. Every week we manually copy deal info into Airtable to kick off project setup. It takes 3-4 hours and introduces errors. We need these systems talking to each other automatically.',
 'batch', 'Marketing', ARRAY['HubSpot','Airtable','Zapier'], ARRAY['API Integration','HubSpot','Airtable'],
 'fixed', 2500, 5000, 'mid', true, 'Australia',
 'Sales-to-delivery handoff is manual — 3-4 hours/week copying data between HubSpot and Airtable',
 'No integration layer between CRM and project management — two separate systems of record for the same deal',
 'Bi-directional sync that triggers when a deal closes in HubSpot, creates an Airtable record, and keeps status fields in sync',
 'Integration',
 'A lightweight sync layer for teams using HubSpot for sales and Airtable for project delivery. Triggered on deal close, it maps CRM fields to project fields, creates the Airtable record, and keeps status in sync as delivery progresses. The HubSpot+Airtable pairing is extremely common in 10-50 person companies — there''s a repeatable product here.',
 'acute', 'strong', 'infrastructure', 9, 'saved', now() - interval '7 days', now() - interval '8 days'),

-- Score 9: Webhook monitoring
('https://www.upwork.com/jobs/~seed005',
 'Build webhook failure monitoring and retry dashboard',
 'We use webhooks from Stripe, GitHub, and our own services. When they fail silently we find out days later from angry customers. We need visibility into webhook delivery status, automatic retries with exponential backoff, and Slack alerts on repeated failures.',
 'batch', 'DevOps', ARRAY['Stripe','GitHub','Slack','n8n'], ARRAY['Node.js','Webhooks','Monitoring'],
 'fixed', 3000, 6000, 'mid', true, 'Germany',
 'Webhook failures are invisible until customers complain days later',
 'No observability layer for webhook delivery — fire and forget with no retry logic or alerting',
 'Webhook proxy that logs all deliveries, retries failures with backoff, surfaces a delivery dashboard, and alerts on patterns',
 'Monitoring & Observability',
 'A webhook reliability layer that sits between your webhook sources and endpoints, logging every delivery attempt, automatically retrying failures with exponential backoff, and surfacing a real-time dashboard of delivery health. Every developer-facing SaaS company needs this — webhook.site exists but has no reliability features.',
 'acute', 'strong', 'infrastructure', 9, 'saved', now() - interval '2 days', now() - interval '3 days'),

-- Score 9: n8n marketplace
('https://www.upwork.com/jobs/~seed006',
 'Build and sell n8n workflow templates for our SaaS product',
 'Our product integrates with 20+ tools. Customers constantly ask for pre-built automation recipes. We want someone to build 10 polished n8n workflow templates and a simple page where customers can browse and one-click install them into their own n8n instance.',
 'batch', 'Automation', ARRAY['n8n','Make','Zapier','Airtable'], ARRAY['n8n','Automation','No-code'],
 'fixed', 2000, 4000, 'mid', true, 'Netherlands',
 'Customers have automation needs but lack the skill to build workflows from scratch',
 'No distribution layer for pre-built workflows — customers start from zero even for common patterns',
 'Template marketplace where vendors publish workflows and customers one-click import them into their automation tool',
 'Marketplace',
 'A workflow template marketplace for the n8n/Make/Zapier ecosystem. SaaS vendors publish polished automation recipes for their product, customers browse and one-click import. Monetize by charging vendors for listings or taking a cut of premium templates. The automation tools themselves won''t build this — too niche — but the demand from vendors wanting to reduce support load is real.',
 'acute', 'strong', 'infrastructure', 9, 'saved', now() - interval '10 days', now() - interval '11 days'),

-- Score 8: Shopify to QuickBooks
('https://www.upwork.com/jobs/~seed007',
 'Shopify orders to QuickBooks sync — automated daily reconciliation',
 'We process 200+ Shopify orders/day. Our bookkeeper manually exports orders and imports to QuickBooks every morning. Takes 2 hours. We need this automated — orders, refunds, fees all reconciled accurately.',
 'batch', 'E-commerce', ARRAY['Shopify','QuickBooks'], ARRAY['Shopify','QuickBooks','Accounting'],
 'fixed', 1500, 3000, 'mid', true, 'United States',
 'Bookkeeper spends 2 hours/day manually reconciling Shopify orders into QuickBooks',
 'No integration between e-commerce platform and accounting system — data lives in two silos',
 'Automated sync that pushes daily Shopify sales, refunds, and fees into QuickBooks as journal entries',
 'Integration',
 'An e-commerce accounting sync that maps Shopify transactions to QuickBooks entries automatically. Every Shopify merchant with a real bookkeeper has this problem — the existing solutions (A2X, Synder) are clunky and overpriced for small stores. A cleaner, cheaper alternative targeting 10-200 orders/day stores would find an easy market.',
 'clear', 'strong', 'infrastructure', 8, 'saved', now() - interval '6 days', now() - interval '7 days'),

-- Score 7: LinkedIn outreach
('https://www.upwork.com/jobs/~seed008',
 'LinkedIn outreach sequence tool — personalized messages at scale',
 'Our SDRs send 50-100 LinkedIn messages/day manually. We need a tool that lets us build multi-step sequences, personalize with LinkedIn profile data, and track reply rates by sequence variant.',
 'batch', 'Sales', ARRAY['LinkedIn','Sales Navigator','Apollo'], ARRAY['LinkedIn','Sales Automation','Outreach'],
 'fixed', 3000, 8000, 'mid', true, 'United States',
 'SDRs manually sending and tracking 50-100 LinkedIn messages/day — no automation or analytics',
 'LinkedIn''s native tools have no sequence or analytics features, and most automation tools violate ToS',
 'Compliant LinkedIn sequence tool with message templates, personalization tokens, and reply tracking',
 'Sales Automation',
 'A LinkedIn outreach tool that stays within platform guidelines while enabling multi-step sequences, profile-based personalization, and A/B testing of message variants. The market is crowded (Expandi, Dux-Soup) but most tools are grey-hat and risk account bans. A genuinely compliant alternative has a clear positioning story.',
 'clear', 'strong', 'recurring', 7, 'saved', now() - interval '4 days', now() - interval '5 days'),

-- Score 6: Slack standup bot
('https://www.upwork.com/jobs/~seed009',
 'Custom Slack standup bot with weekly digest and blocker tracking',
 'We have 4 remote teams in different timezones. Daily standups are hard. We want a Slack bot that collects async standup answers (what did you do, what will you do, any blockers) on a schedule, posts a digest, and tracks unresolved blockers across days.',
 'batch', 'Project Management', ARRAY['Slack','Jira','Notion'], ARRAY['Slack','Bot Development','Project Management'],
 'fixed', 1000, 2500, 'mid', false, 'Singapore',
 'Remote teams miss context on what others are working on; blockers go unresolved for days',
 'No async standup system — synchronous standups don''t work across timezones',
 'Slack bot that prompts for async updates, aggregates into a digest, and persists unresolved blockers',
 'Workflow Automation',
 'An async standup bot for Slack that handles multi-timezone teams. Beyond just collecting answers, it tracks unresolved blockers day-over-day and escalates if something''s been stuck for 2+ days. Geekbot exists but is expensive per user — a simpler, cheaper alternative targeting teams under 30 people has room to exist.',
 'clear', 'possible', 'recurring', 6, 'saved', now() - interval '9 days', now() - interval '10 days'),

-- Score 6: Legal contract comparison
('https://www.upwork.com/jobs/~seed010',
 'Contract clause comparison tool for legal team review',
 'Our legal team reviews 20+ vendor contracts/month. The most painful part is comparing our standard clause language against what the vendor sent. They want a tool to paste two contract sections and get a diff view with risk flags on non-standard language.',
 'batch', 'Legal', ARRAY['DocuSign','Notion'], ARRAY['Legal Tech','NLP','Document Processing'],
 'fixed', 5000, 10000, 'high', false, 'United Kingdom',
 'Legal team manually side-by-sides contract sections looking for clause deviations — slow and error-prone',
 'No structured diff tool for contract language — lawyers use Word track changes which misses semantic differences',
 'Contract diff tool that highlights clause-level deviations and flags language that deviates from standard templates',
 'AI Analysis',
 'A contract review tool that compares incoming vendor contracts against a company''s standard clause library, highlights deviations at the sentence level, and flags risk patterns (one-sided liability, unusual IP terms, missing clauses). Legal teams at 50-500 person companies that can''t afford enterprise CLM software are the target — high budget, recurring need.',
 'clear', 'possible', 'recurring', 6, 'saved', now() - interval '12 days', now() - interval '13 days'),

-- Score 5: Invoice tracker
('https://www.upwork.com/jobs/~seed011',
 'Freelancer invoice tracker with late payment nudges',
 'I''m a freelance designer with ~15 active clients. I lose track of which invoices are outstanding. I need something simple: log invoices, mark paid, see what''s overdue, and optionally send a polite follow-up email.',
 'single', 'Finance', ARRAY['FreshBooks','Wave'], ARRAY['Invoicing','Freelance','Finance'],
 'fixed', 200, 500, 'low', true, 'Canada',
 'Outstanding invoices slip through the cracks — 2-3 per month go unpaid past 30 days',
 'No single place to track invoice status across clients — relies on email search and memory',
 'Simple invoice tracker with status tracking, overdue alerts, and one-click follow-up email templates',
 'Productivity Tool',
 'A dead-simple invoice tracker for freelancers and small agencies. Log invoices, mark paid, get overdue alerts, send follow-up emails with one click. Wave and FreshBooks exist but are overkill for people who just want to track 10-20 invoices. A $9/month Stripe-billed product with zero accounting features has a clear niche.',
 'clear', 'possible', 'recurring', 5, 'saved', now() - interval '8 days', now() - interval '9 days'),

-- Score 4: Social scheduler (crowded)
('https://www.upwork.com/jobs/~seed012',
 'Social media scheduling tool for our marketing agency',
 'We manage social for 12 clients. We use Buffer but it''s getting expensive and the approval workflow is clunky. We want to evaluate building something custom or finding a cheaper alternative that handles multi-client approval flows.',
 'batch', 'Marketing', ARRAY['Buffer','Hootsuite','Later'], ARRAY['Social Media','Marketing','Scheduling'],
 'fixed', 3000, 8000, 'mid', false, 'United States',
 'Approval workflow for multi-client social scheduling is clunky and expensive with existing tools',
 'Buffer''s pricing scales poorly for agencies managing many clients; approval UX is friction-heavy',
 'Custom scheduling tool with client-specific approval workflows and consolidated calendar view',
 'Productivity Tool',
 'A social media scheduling platform purpose-built for small agencies. Unlike Buffer/Hootsuite, priced per agency rather than per seat, with client-specific approval flows built in. Crowded space — would need a very specific niche (e.g., "for real estate agencies" or "for restaurant groups") to avoid competing head-on with well-funded incumbents.',
 'vague', 'unlikely', 'recurring', 4, 'saved', now() - interval '15 days', now() - interval '16 days'),

-- Inbox items (unprocessed)
('https://www.upwork.com/jobs/~seed013',
 'Build Chrome extension to capture data from competitor websites',
 'We track pricing and features across 30 competitor tools manually in a spreadsheet. Need a Chrome extension that can scrape structured data from competitor pages on a schedule and populate a Google Sheet automatically.',
 'batch', null, null, ARRAY['Chrome Extension','Web Scraping','Python'],
 'fixed', 1500, 3000, 'mid', null, null,
 null, null, null, null, null,
 null, null, null, null,
 'inbox', null, now() - interval '1 day'),

('https://www.upwork.com/jobs/~seed014',
 'Automate our agency client reporting — pull data from GA4, Meta Ads, Google Ads',
 'We send weekly reports to 20 clients. Each report is manually built in Google Slides pulling data from GA4, Meta Ads, Google Ads. Takes our team 8 hours every Friday. We need this automated.',
 'batch', null, null, ARRAY['Google Analytics','Meta Ads','Google Ads','Google Slides'],
 'fixed', 4000, 8000, 'high', null, null,
 null, null, null, null, null,
 null, null, null, null,
 'inbox', null, now() - interval '2 days'),

('https://www.upwork.com/jobs/~seed015',
 'Notion database to CSV export with custom field mapping',
 'We use Notion as our CRM. We need to export specific database views to CSV weekly for our finance team, with field names remapped to match their spreadsheet format. Currently done manually.',
 'batch', null, null, ARRAY['Notion','Python'],
 'fixed', 300, 800, 'low', null, null,
 null, null, null, null, null,
 null, null, null, null,
 'inbox', null, now() - interval '3 days')

ON CONFLICT (upwork_url) DO NOTHING;

-- Tags for saved ideas
INSERT INTO idea_tags (idea_id, tag, source)
SELECT id, tag, 'auto' FROM ideas
CROSS JOIN UNNEST(ARRAY[
  CASE upwork_url
    WHEN 'https://www.upwork.com/jobs/~seed001' THEN 'customer service'
    WHEN 'https://www.upwork.com/jobs/~seed002' THEN 'e-commerce'
    WHEN 'https://www.upwork.com/jobs/~seed003' THEN 'saas'
    WHEN 'https://www.upwork.com/jobs/~seed004' THEN 'marketing'
    WHEN 'https://www.upwork.com/jobs/~seed005' THEN 'devops'
    WHEN 'https://www.upwork.com/jobs/~seed006' THEN 'automation'
    WHEN 'https://www.upwork.com/jobs/~seed007' THEN 'e-commerce'
    WHEN 'https://www.upwork.com/jobs/~seed008' THEN 'sales'
    WHEN 'https://www.upwork.com/jobs/~seed009' THEN 'project management'
    WHEN 'https://www.upwork.com/jobs/~seed010' THEN 'legal'
    WHEN 'https://www.upwork.com/jobs/~seed011' THEN 'finance'
    WHEN 'https://www.upwork.com/jobs/~seed012' THEN 'marketing'
  END
]) AS t(tag)
WHERE upwork_url LIKE '%seed0%' AND tag IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO idea_tags (idea_id, tag, source)
SELECT id, tag, 'auto' FROM ideas
CROSS JOIN UNNEST(ARRAY[
  CASE upwork_url
    WHEN 'https://www.upwork.com/jobs/~seed001' THEN 'ai triage'
    WHEN 'https://www.upwork.com/jobs/~seed002' THEN 'analytics dashboard'
    WHEN 'https://www.upwork.com/jobs/~seed003' THEN 'workflow automation'
    WHEN 'https://www.upwork.com/jobs/~seed004' THEN 'integration'
    WHEN 'https://www.upwork.com/jobs/~seed005' THEN 'monitoring & observability'
    WHEN 'https://www.upwork.com/jobs/~seed006' THEN 'marketplace'
    WHEN 'https://www.upwork.com/jobs/~seed007' THEN 'integration'
    WHEN 'https://www.upwork.com/jobs/~seed008' THEN 'sales automation'
    WHEN 'https://www.upwork.com/jobs/~seed009' THEN 'workflow automation'
    WHEN 'https://www.upwork.com/jobs/~seed010' THEN 'ai analysis'
    WHEN 'https://www.upwork.com/jobs/~seed011' THEN 'productivity tool'
    WHEN 'https://www.upwork.com/jobs/~seed012' THEN 'productivity tool'
  END
]) AS t(tag)
WHERE upwork_url LIKE '%seed0%' AND tag IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO idea_tags (idea_id, tag, source)
SELECT id, 'strong-fit', 'auto' FROM ideas
WHERE upwork_url IN (
  'https://www.upwork.com/jobs/~seed001',
  'https://www.upwork.com/jobs/~seed002',
  'https://www.upwork.com/jobs/~seed003',
  'https://www.upwork.com/jobs/~seed004',
  'https://www.upwork.com/jobs/~seed005',
  'https://www.upwork.com/jobs/~seed006',
  'https://www.upwork.com/jobs/~seed007',
  'https://www.upwork.com/jobs/~seed008'
)
ON CONFLICT DO NOTHING;

INSERT INTO idea_tags (idea_id, tag, source)
SELECT id, 'infrastructure', 'auto' FROM ideas
WHERE upwork_url IN (
  'https://www.upwork.com/jobs/~seed001',
  'https://www.upwork.com/jobs/~seed002',
  'https://www.upwork.com/jobs/~seed003',
  'https://www.upwork.com/jobs/~seed004',
  'https://www.upwork.com/jobs/~seed005',
  'https://www.upwork.com/jobs/~seed006',
  'https://www.upwork.com/jobs/~seed007'
)
ON CONFLICT DO NOTHING;

INSERT INTO idea_tags (idea_id, tag, source)
SELECT id, 'high-budget', 'auto' FROM ideas
WHERE upwork_url IN (
  'https://www.upwork.com/jobs/~seed001',
  'https://www.upwork.com/jobs/~seed002',
  'https://www.upwork.com/jobs/~seed003',
  'https://www.upwork.com/jobs/~seed010'
)
ON CONFLICT DO NOTHING;

INSERT INTO idea_tags (idea_id, tag, source)
SELECT id, 'recurring-need', 'auto' FROM ideas
WHERE upwork_url IN (
  'https://www.upwork.com/jobs/~seed008',
  'https://www.upwork.com/jobs/~seed009',
  'https://www.upwork.com/jobs/~seed010',
  'https://www.upwork.com/jobs/~seed011',
  'https://www.upwork.com/jobs/~seed012'
)
ON CONFLICT DO NOTHING;

-- Tool tags
INSERT INTO idea_tags (idea_id, tag, source)
SELECT i.id, 'tool:zapier', 'auto' FROM ideas i
WHERE i.upwork_url IN ('https://www.upwork.com/jobs/~seed004', 'https://www.upwork.com/jobs/~seed006')
ON CONFLICT DO NOTHING;

INSERT INTO idea_tags (idea_id, tag, source)
SELECT i.id, 'tool:shopify', 'auto' FROM ideas i
WHERE i.upwork_url IN ('https://www.upwork.com/jobs/~seed002', 'https://www.upwork.com/jobs/~seed007')
ON CONFLICT DO NOTHING;

INSERT INTO idea_tags (idea_id, tag, source)
SELECT i.id, 'tool:hubspot', 'auto' FROM ideas i
WHERE i.upwork_url IN ('https://www.upwork.com/jobs/~seed003', 'https://www.upwork.com/jobs/~seed004')
ON CONFLICT DO NOTHING;

INSERT INTO idea_tags (idea_id, tag, source)
SELECT i.id, 'tool:slack', 'auto' FROM ideas i
WHERE i.upwork_url IN ('https://www.upwork.com/jobs/~seed005', 'https://www.upwork.com/jobs/~seed009')
ON CONFLICT DO NOTHING;

INSERT INTO idea_tags (idea_id, tag, source)
SELECT i.id, 'tool:n8n', 'auto' FROM ideas i
WHERE i.upwork_url IN ('https://www.upwork.com/jobs/~seed005', 'https://www.upwork.com/jobs/~seed006')
ON CONFLICT DO NOTHING;
