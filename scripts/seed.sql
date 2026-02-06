-- Seed data: sample buyers
INSERT INTO buyers (upwork_client_name, total_spent, location) VALUES
  ('Sarah M.', '$45K+', 'Austin, TX'),
  ('Mike R.', '$12K+', 'Denver, CO'),
  ('Jennifer L.', '$8K+', 'Miami, FL'),
  ('David K.', '$22K+', 'Portland, OR'),
  ('Lisa T.', '$5K+', 'London, UK'),
  ('Alex P.', '$3K+', 'New York, NY'),
  ('Chris B.', '$30K+', 'Phoenix, AZ')
ON CONFLICT DO NOTHING;

-- Seed data: sample listings
INSERT INTO listings (title, description, budget_type, budget_min, budget_max, skills, category, buyer_id, raw_data) VALUES
(
  'Build Salesforce-DocuSign integration for real estate brokerage',
  'We are a real estate brokerage (50+ agents) and need to connect our Salesforce CRM with DocuSign. When an agent closes a deal, the data should automatically flow from Salesforce into DocuSign for e-signatures. Currently our agents are manually copying data between the two systems, wasting 30+ minutes per transaction. We need someone experienced with both platforms'' APIs.',
  'fixed', 3000, 5000,
  ARRAY['Salesforce', 'DocuSign API', 'REST API', 'JavaScript'],
  'Web Development',
  (SELECT id FROM buyers WHERE upwork_client_name = 'Sarah M.'),
  '{}'::jsonb
),
(
  'Automate closing workflow — CRM to document signing',
  'Real estate team looking for automation help. Our closing process is entirely manual: agent updates CRM, then re-enters same info in dotloop for signatures, then manually tracks status in a spreadsheet. Need someone to build an automated pipeline. Open to Zapier or custom solution.',
  'fixed', 2000, 4000,
  ARRAY['Zapier', 'CRM', 'API Integration', 'dotloop'],
  'Automation',
  (SELECT id FROM buyers WHERE upwork_client_name = 'Mike R.'),
  '{}'::jsonb
),
(
  'Connect HubSpot to DocuSign for property management',
  'Property management company. We use HubSpot as our CRM and DocuSign for lease agreements. Need these two connected so when a lead converts to a tenant, lease docs are auto-generated and sent. We also want signed docs to sync back to HubSpot contact records.',
  'fixed', 2500, 3500,
  ARRAY['HubSpot', 'DocuSign', 'API', 'Node.js'],
  'Web Development',
  (SELECT id FROM buyers WHERE upwork_client_name = 'Jennifer L.'),
  '{}'::jsonb
),
(
  'Shopify inventory sync with QuickBooks',
  'We run an e-commerce store on Shopify and our accounting is in QuickBooks Online. Need real-time sync of inventory levels, orders, and revenue between the two. Currently exporting CSVs manually every day which is error-prone. Looking for a reliable automated solution.',
  'fixed', 1500, 2500,
  ARRAY['Shopify', 'QuickBooks', 'API Integration', 'Python'],
  'E-commerce Development',
  (SELECT id FROM buyers WHERE upwork_client_name = 'David K.'),
  '{}'::jsonb
),
(
  'WooCommerce to Xero accounting automation',
  'Small e-commerce brand. Every order on our WooCommerce store needs to be manually entered into Xero as an invoice. With 50+ orders per day this is killing us. Need someone to automate the flow: order placed → invoice created in Xero → inventory updated. Must handle refunds and partial payments too.',
  'hourly', 40, 75,
  ARRAY['WooCommerce', 'Xero API', 'PHP', 'REST API'],
  'Web Development',
  (SELECT id FROM buyers WHERE upwork_client_name = 'Lisa T.'),
  '{}'::jsonb
),
(
  'Scrape competitor pricing data daily',
  'E-commerce company selling electronics. We need to monitor competitor prices on Amazon and 3 other sites daily. Currently checking manually. Need a script that scrapes prices for ~200 SKUs daily and dumps into a Google Sheet or Airtable with change alerts.',
  'fixed', 800, 1500,
  ARRAY['Web Scraping', 'Python', 'BeautifulSoup', 'Google Sheets API'],
  'Data Science & Analytics',
  (SELECT id FROM buyers WHERE upwork_client_name = 'Alex P.'),
  '{}'::jsonb
),
(
  'Real estate CRM integration with MLS data feed',
  'We need our CRM (Follow Up Boss) integrated with our local MLS data feed (RETS/RESO). Want new listings to auto-import, and when our agents claim a lead, the relevant listing data should populate in the CRM. Currently agents are copy-pasting listing details manually.',
  'fixed', 4000, 6000,
  ARRAY['RETS', 'API Integration', 'CRM', 'Python'],
  'Web Development',
  (SELECT id FROM buyers WHERE upwork_client_name = 'Chris B.'),
  '{}'::jsonb
),
(
  'Build automated lead nurture email sequences for real estate',
  'Real estate team of 20 agents. We get leads from Zillow, Realtor.com, and our website but our follow-up is inconsistent. Need automated email/SMS sequences based on lead source and behavior. Must integrate with our CRM (kvCORE). Think drip campaigns but smarter — trigger based actions.',
  'fixed', 2000, 3500,
  ARRAY['Email Marketing', 'CRM', 'Automation', 'kvCORE'],
  'Marketing Automation',
  NULL,
  '{}'::jsonb
)
ON CONFLICT DO NOTHING;
