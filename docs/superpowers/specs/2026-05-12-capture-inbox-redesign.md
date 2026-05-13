# Spec: Capture Inbox Redesign

## Objective

Replace the current dashboard-first experience with a capture-first workflow for building a private Upwork opportunity database. The primary user is the repo owner capturing interesting jobs from the Chrome extension. Success means a newly saved job is immediately visible in the app without waiting for AI analysis, clustering, or trend generation.

Primary workflow:

1. Extension saves a raw Upwork job to `/api/listings`.
2. App shows the job in an inbox immediately.
3. User reviews, tags, notes, archives, or promotes the job.
4. AI enrichment runs manually or in batch after capture.
5. Curated opportunities become the source for deeper analysis.

## Tech Stack

- Next.js 15 App Router in `web/`
- React 19 client components
- TypeScript with `strict` enabled
- PostgreSQL via `pg` in `web/src/lib/db.ts`
- Existing Chrome extension in `extension/`

## Commands

- Dev app: `cd web && npm run dev`
- Build/type-check: `cd web && npm run build`
- Extension sandbox: `node scripts/extension-sandbox.mjs`
- Database setup: `./scripts/setup-db.sh`

## Product Structure

- `/inbox`: raw captured listings, newest first. This should become the default working view.
- `/inbox/[id]` or detail panel: full listing text, source URL, capture metadata, notes, tags, and actions.
- `/opportunities`: curated jobs promoted from the inbox.
- `/processing`: operational page for AI extraction, retry, and clustering jobs.
- Legacy dashboards (`/`, `/trends`, current `/import`) should be demoted or removed after the new flow is usable.

## Data Behavior

Captured listings must be useful before AI processing. Required visible fields are `title`, `description`, `upwork_url`, `skills`, `budget_type`, `budget_min`, `budget_max`, `captured_at`, and processing status. The UI should distinguish raw, processed, archived, and promoted records.

If the schema does not already support review state, add fields such as `review_status`, `notes`, and `tags` or introduce a small related table. Ask before making destructive schema changes.

## UI Principles

The app should feel like an operational review tool, not an analytics landing page. Prioritize dense lists, fast scanning, filters, keyboard-friendly review actions, and clear status labels. Avoid charts until the capture/review loop is solid.

## Testing Strategy

- Keep `node scripts/extension-sandbox.mjs` passing for extension capture behavior.
- Use `cd web && npm run build` as the required web verification until a test runner exists.
- Add route/API tests if a test framework is introduced.
- Manually verify: save from extension, open inbox, confirm the record appears without running AI.

## Boundaries

- Always: preserve extension capture to `/api/listings`; keep raw records visible before AI.
- Ask first: destructive schema changes, deleting legacy pages, adding dependencies.
- Never: hide captured data behind AI processing, commit secrets, or make the extension wait on AI analysis.

## Success Criteria

- A 201 response from `/api/listings` results in a visible inbox row immediately.
- The user can open the row and inspect the raw job data.
- The user can mark a job as archived, reviewing, or opportunity.
- AI processing is optional and visibly separate from capture.
- The old dashboard/import workflow is no longer required to answer “where did my saved job go?”

## Open Questions

- Should `/inbox` replace `/` as the home page immediately?
- Do notes/tags belong directly on `listings`, or in related tables?
- Should AI enrichment run per selected job, batch-only, or both?
- What review statuses should be canonical?
