# Repository Guidelines

## Project Structure & Module Organization

Application routes and API handlers live in `src/app/`. Reusable UI belongs in `src/components/`; domain logic and colocated unit tests belong in `src/features/`; infrastructure clients live in `src/lib/`. Database migrations are ordered SQL files in `supabase/migrations/`. Keep static assets in `public/`. Do not commit `.env.local`, `.next/`, `node_modules/`, or Supabase temporary state.

## Build, Test, and Development Commands

- `npm run dev` starts Next.js on `http://localhost:3000`.
- `npm run build` creates the production build; `npm start` serves it.
- `npm run lint`, `npm run typecheck`, and `npm test` run the required quality checks.
- `npm run supabase:start` starts the local stack; `npm run supabase:reset` reapplies migrations and deletes local data.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, semicolons, and double quotes. Name components and types with `PascalCase`, functions and variables with `camelCase`, and route directories with lowercase names. Validate all external input with Zod. Keep server-only data access in Server Components, Server Actions, or Route Handlers, and always enforce authorization in Supabase RLS as well as application code.

## Testing Guidelines

Colocate unit tests as `*.test.ts`; use Vitest for deterministic domain logic. Add Playwright coverage under `tests/e2e/` when browser flows are introduced. Mock Scryfall in automated tests. Database changes must pass `npx supabase db lint --local` and be reproducible from a clean reset.

## Commit & Pull Request Guidelines

Use concise Conventional Commit subjects, such as `feat: add deck versioning` or `fix: enforce post ownership`. Pull requests should explain the behavior, list verification performed, link issues, and include screenshots for UI changes. Call out migrations, new environment variables, and security implications.

## Security & Configuration

Keep secrets out of client bundles and Git. Document variables in `.env.example`. Respect Scryfall request limits, identify server requests, cache responses, and display card imagery without alteration.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
