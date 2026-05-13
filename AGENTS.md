# Repository Guidelines

## Project Structure & Module Organization

This repository contains a Next.js app, a Chrome extension, database schema files, and design notes. The web app lives in `web/` and uses the App Router under `web/src/app/`. Shared server utilities are in `web/src/lib/`, types in `web/src/types/`, and reusable UI components in `web/src/app/components/`. Extension files live in `extension/` (`manifest.json`, `popup.*`, `content.js`). Database setup is defined in `schema.sql`, with helpers and seed data in `scripts/`, `seed.sql`, and `seed`. Planning documents are under `docs/superpowers/`.

## Build, Test, and Development Commands

Run commands from `web/` unless noted otherwise.

- `npm install`: install Next.js, React, PostgreSQL, and Anthropic SDK dependencies.
- `npm run dev`: start the web app on port `3939` and write logs to `web/logs/dev.log`.
- `npm run build`: create a production Next.js build and type-check the app.
- `npm run start`: serve the production build after `npm run build`.
- `../scripts/setup-db.sh`: create the local `pangolin` database and apply `schema.sql`.
- `../dev list`: list experimental worktree UI variants, if those worktrees are present.

## Coding Style & Naming Conventions

Use TypeScript for web code and plain JavaScript for the extension. The web app has `strict` TypeScript enabled and uses the `@/*` alias for `web/src/*`. Follow the existing style: two-space indentation, double quotes, semicolons, PascalCase React components (`ListingCard.tsx`), camelCase functions and variables, and lowercase route directories. Keep API handlers in `route.ts` files and database access in `web/src/lib/db.ts`.

## Testing Guidelines

There is no active test script configured in `web/package.json`. For now, treat `npm run build` as the required verification step for TypeScript and Next.js integration. When adding logic-heavy utilities, add focused tests alongside the code, preferably in `web/src/lib/__tests__/`, and wire a test script into `web/package.json` in the same change. For API work, include a curl smoke test against `npm run dev` where practical.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit prefixes such as `feat:`, `fix:`, and `docs:`. Keep commit subjects imperative and specific, for example `fix: throttle API requests` or `docs: add contributor guide`. Pull requests should describe the user-facing change, list verification performed, mention database or environment changes, and include screenshots for UI or extension popup changes.

## Security & Configuration Tips

Copy `web/.env.example` to `web/.env.local` for local configuration. Set `DATABASE_URL` and `ANTHROPIC_API_KEY` locally, and never commit real credentials. Extension changes should continue to minimize requested Chrome permissions and avoid unsafe DOM writes.
