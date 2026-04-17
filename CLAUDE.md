# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Environment

When working on Windows/Git Bash, always check platform compatibility first before attempting Unix-specific solutions. Use `uname -a` and `echo $SHELL` to detect the environment early.

## GitHub Integration

Before fetching from private GitHub repos, first verify `gh` CLI is installed and authenticated (`gh auth status`). Never attempt raw URL fetches on private repos.

## Troubleshooting Guidelines

When a fix attempt fails twice for the same issue, stop and reassess the approach rather than trying more variations of the same strategy.

## Project Overview

学术红书 (Academic XiaoHongShu) — a Chinese academic social platform. Users share research posts with LaTeX support, cite papers, join discussion rooms, and get AI-powered summaries/translations.

## Commands

```bash
npm run dev          # Start dev server (Next.js 16 + Turbopack)
npm run build        # Production build
npm run lint         # ESLint (flat config)
npx tsc --noEmit     # Type check without emitting
npx prisma generate  # Regenerate Prisma client (output: src/generated/prisma/)
npx prisma db seed   # Seed database (runs: npx tsx prisma/seed.ts)
npx prisma migrate dev  # Create/apply migration
npx prisma studio    # Open Prisma Studio GUI
```

## Tech Stack (Non-Obvious Versions)

- **Next.js 16.2** — breaking changes from 15; async `params` required in all route handlers (`params: Promise<{ id: string }>`)
- **React 19** — new hooks and behavior
- **Prisma 7** — requires `@prisma/adapter-pg` driver adapter; client generated to `src/generated/prisma/` (not node_modules)
- **Tailwind CSS v4** — CSS-native config via `globals.css` `@theme inline`, no `tailwind.config.js`
- **NextAuth v5 beta** (`next-auth@5.0.0-beta.30`) — `auth()` server function, JWT strategy
- **Zod v4** — import from `"zod/v4"` (subpath export), not `"zod"`
- **shadcn/ui** — `base-nova` style, uses `@base-ui/react` primitives (not Radix)
- **TipTap v3** — rich text editor with custom KaTeX math extensions

## Architecture

### Route Groups
- `(auth)/` — login/register pages, minimal centered layout, no navigation
- `(main)/` — all app pages, layout adds Header + CategoryTabs + MobileNav

### Data Flow Patterns
- **Feed**: `useSWRInfinite` → `GET /api/posts?cursor=` → cursor-based pagination
- **Subjects**: `useSWRImmutable("/api/subjects")` → cached, never revalidates; 62 level-1 + 738 level-2 disciplines (GB/T 13745-2009)
- **Room chat**: SSE via `GET /api/rooms/[id]/stream` (server polls DB every 3-5s) + optimistic message sends
- **AI features**: Streaming responses via `ReadableStream<Uint8Array>`, client reads with `reader.read()` loop

### Key Services (`src/services/`)
- `ai.service.ts` — Ollama API (model `gemma4:31b-it-bf16`) via OpenAI-compatible SDK, streaming
- `paper.service.ts` — Semantic Scholar + CrossRef APIs for paper search/metadata

### Database
- PostgreSQL via Supabase, accessed through Prisma with `PrismaPg` adapter
- Supabase Storage for file uploads (avatars, images) — separate client in `src/lib/supabase-storage.ts`
- `src/lib/prisma.ts` — singleton pattern with `globalThis` caching in dev

### Auth (`src/lib/auth.ts`)
- Providers: Credentials (bcrypt), Google, GitHub
- JWT strategy, 30-day sessions
- Custom registration at `POST /api/auth/register`
- Session augmented with `id, username, displayName, avatar, role`
- No middleware.ts — auth enforced per-route with `await auth()`

### Subject System
- Hierarchical: parent/children self-relation on `Subject` model
- Seed data in `prisma/seed.ts` (~800 entries, sorted by academic popularity)
- API at `/api/subjects` returns tree; client hook `useSubjects()` caches immutably
- Posts API resolves parent→children for category filtering (browsing a level-1 subject includes all its level-2 posts)

## Conventions

- **Prisma queries**: Always use `select` (never `include`) for precise field control
- **API auth pattern**: `const session = await auth(); if (!session?.user?.id) return 401`
- **Pagination**: Cursor-based (`where.id = { lt: cursor }`), never offset-based
- **Client components**: Explicit `"use client"` directive; hooks live in `src/lib/hooks/`
- **Styling**: `cn()` utility (clsx + tailwind-merge) for conditional classes; colors via inline `style={{ backgroundColor: subject.color }}` for dynamic subject colors
- **Path alias**: `@/*` maps to `./src/*`
- **Type definitions**: All shared DTOs in `src/types/index.ts`; NextAuth augmentation in `src/types/next-auth.d.ts`
- **Post content**: Stored as TipTap JSON (`content: Json` in Prisma); rendered via TipTap in read-only mode or `ContentRenderer`

## Environment Variables

Required in `.env`:
- `DATABASE_URL` — Supabase PostgreSQL connection string
- `NEXTAUTH_SECRET` — JWT signing secret
- `AUTH_GOOGLE_ID/SECRET`, `AUTH_GITHUB_ID/SECRET` — OAuth providers
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — file storage
- `OLLAMA_BASE_URL` — Ollama server URL (e.g. `http://localhost:11434/v1`)
- `OLLAMA_MODEL` — Ollama model name (default: `gemma4:31b-it-bf16`)
