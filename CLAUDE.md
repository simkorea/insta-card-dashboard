# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build
npm run start    # start production server
npm run lint     # eslint (flat config: eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit # type-check only (no test runner is configured in this repo)
```

There is no test suite configured — do not assume `npm test` exists.

## Architecture

Next.js 16 App Router project (React 19, TypeScript, Tailwind v4) for generating and publishing "카드뉴스" (Instagram-style multi-slide card news graphics) with AI-assisted copywriting, design editing, and SNS auto-posting.

### Auth & route protection

Supabase Auth (`@supabase/ssr`) gates the app via `middleware.ts`, not per-route checks:
- `PUBLIC_PAGE_PATHS` / `PUBLIC_API_PATHS` are allow-listed; everything else requires a session.
- `PROTECTED_API_PREFIXES` in `middleware.ts` is the source of truth for which `/api/*` routes 401 without auth — when adding a new API route under an existing feature prefix it inherits protection automatically, but a genuinely new top-level prefix must be added to this list explicitly or it stays unauthenticated.
- Security headers (`X-Frame-Options`, CSP-adjacent headers, etc.) are applied in both `middleware.ts` and `next.config.ts` — keep them in sync if changed.
- Three Supabase client variants exist for three contexts, do not cross-use them: `src/lib/supabase.ts` (plain anon client), `src/lib/supabase-server.ts` (`createSupabaseServer()`, cookie-aware, for Server Components/route handlers), `src/lib/supabase-browser.ts` (`createSupabaseBrowser()`, for Client Components).

### AI generation layer (`src/lib/gemini.ts`, `src/lib/ai/openrouter.ts`)

All AI text/copy generation should go through `generateWithRetry()` in `src/lib/gemini.ts`, which implements a 3-tier fallback: Gemini `2.5-flash` → wait 5s, retry `2.5-flash-lite` → OpenRouter (`deepseek` via `callAI()`) as last resort (only for plain string prompts). Route handlers catch errors and convert them with `toKoreanError()` (server-side) or `friendlyError()` in `src/lib/errors.ts` (client-safe, no server imports) — both map provider errors (503/429/timeout/JSON parse failures) to user-facing Korean messages. Follow this pattern for new AI-backed routes rather than calling the Gemini/OpenAI SDKs directly.

AI routes (`/api/generate-card`, `/api/ai-designer`, `/api/analyze`, etc.) prompt the model to return raw JSON and manually strip ```` ```json ```` fences before `JSON.parse` — there's no structured-output/schema enforcement, so keep that fence-stripping when adding similar routes.

### Card news domain model (`src/lib/cardnews/`)

- `blocks.ts` defines the slide content model: a `SlideBlock` is a tagged union (`eyebrow`, `headline`, `sub`, `bigNumber`, `statGrid`, `compareTable`, `timeline`, `checklist`, `badgeRow`, `sourceNote`), each with an optional `offsetY` for manual vertical nudging. All pixel values assume a 420px-wide canvas coordinate system.
- `theme.ts` defines two brand tones (`gold` / `sage`, mapped to two client brands) plus shared "glass panel" styling tokens (`GLASS`). New brand tones should follow the `TONE` map + `tone()` accessor pattern.
- `src/components/cardnews/BlockRenderer.tsx` renders a `SlideBlock[]` and owns non-obvious behavior: an auto-fit scale-down (`fitScale`) that shrinks content via CSS `transform: scale()` when it overflows `availableHeight` (min 0.55x), recomputed on font-load (`document.fonts.ready`) and `ResizeObserver`, plus per-block drag-to-reposition (pointer events, writes back through `onBlockOffsetChange`). `titleStyle`/`subtitleStyle`/`bulletStyle` props let the AI designer (`/api/ai-designer`) override typography per-slide.
- `src/components/cardnews/SlideFrame.tsx` wraps individual slides (canvas chrome around `BlockRenderer`).
- The editor UI lives at `src/app/cardnews/editor/page.tsx`; the gallery/list view at `src/app/cardnews/page.tsx`.

### Data persistence

Supabase Postgres, schema managed by hand-run SQL files at the repo root (no `supabase/migrations` directory) — `supabase_card_designs.sql`, `update_schema.sql`, `update_persona_schema.sql`. Key tables: `card_designs` (id, name, description, `pages_data` JSONB, category), `brand_personas` (persona_name, `user_id` FK to `auth.users` with cascade delete). When schema changes are needed, add a new numbered/dated SQL file in this same style rather than editing the old ones in place, and note that RLS policies here are currently permissive (`USING (true)`) rather than scoped to `auth.uid()`.

### Export/rendering

Client-side slide-to-image/PDF export uses `html-to-image` / `html2canvas` + `jspdf` + `jszip` (multi-slide zip/PDF bundling) — these run in the browser against rendered `BlockRenderer` DOM, not server-side.

### SNS integrations & scheduling

`/api/instagram/*` handles OAuth (`auth`, `callback`), publishing, insights, and settings. `vercel.json` defines two cron-triggered routes (Vercel Cron, not a queue): `/api/cron/instagram` (daily 09:00 UTC) and `/api/briefing` (daily 23:00 UTC). Threads/TikTok/YouTube credentials also exist in env but check which integrations are actually wired to a route before assuming a platform is live.

### Conventions

- User-facing strings, code comments, and error messages are predominantly Korean — match this when adding new UI text or comments.
- `next.config.ts` disables TLS cert verification in non-production (`NODE_TLS_REJECT_UNAUTHORIZED = '0'`) to work around a corporate proxy — this is dev-only, don't remove without checking why it's there.
- Path alias `@/*` → `./src/*` (see `tsconfig.json`).
