# Pro UI Redesign — Design Spec

**Date:** 2026-06-05
**Branch / worktree:** `worktree-redesign-pro-ui`
**Goal:** Redesign the whole single-page Project Workspace app so it looks and feels
professional on desktop and mobile — intentional motion, polished UI/UX, "love at
first sight." Front-end only; no backend/API/data/test changes.

## Approved direction

- **Visual style:** Refined dark SaaS (Linear / Vercel feel) — charcoal canvas, layered
  surfaces, one violet accent, tight typography, crisp micro-interactions.
- **Color mode:** Light **and** dark, with an animated, persisted toggle.
- **Tech:** Tailwind CSS v4 (CSS-first `@theme`) + Framer Motion for the few animations
  that earn it (modal, list stagger, segmented control, toggle). Inter via `next/font`.
- **UX polish (all in):** micro-interactions, empty & loading states, toast feedback,
  richer project rows (created date, status filter, search).

## Design tokens

- Dark canvas `#0B0D10`; surfaces `#14171C` / `#1B1F26`; hairline borders.
- Accent violet `#7C5CFC` → `#9D7BFF` gradient. Status: emerald (active), amber (paused),
  rose (archived).
- Light theme = warm-white canvas mirroring the same token names so one component layer
  serves both themes. All tokens are CSS variables under `@theme` + `[data-theme]`.
- Radii 8–14px, soft elevation shadows, motion duration/easing tokens.
- `prefers-reduced-motion` honored everywhere.

## Components (`src/app/`)

- **Theme:** `theme-script.tsx` (inline no-flash), `theme-provider` + `theme-toggle.tsx`
  (sun/moon morph, persisted to localStorage).
- **Header:** org name, "signed in as", segmented **Ana/Ben switcher** (animated active
  pill via Framer `layoutId`), theme toggle.
- **Stat row:** `stat-card.tsx` projects metric with animated **count-up**; plan pill.
- **Create form:** restyled card; inline validation; optimistic add; **toast** on
  success/error (replaces inline message); loading button state.
- **Projects panel:** `projects-panel.tsx` (client) — status filter (All/Active/Paused/
  Archived) + search over already-fetched data, staggered reveal, **empty state**,
  **skeleton** during refresh; `project-row.tsx` (name + created date + `status-badge.tsx`
  glowing dot). Table collapses to stacked cards under ~640px.
- **Toast:** `toast.tsx` provider + hook + portal; top-right (bottom sheet on mobile),
  auto-dismiss, stacking, reduced-motion aware.
- **Upgrade modal:** keep existing a11y (focus trap, ESC, scroll lock, mobile bottom
  sheet); reskin to new tokens + dark theme.

## Constraints / non-goals

- No changes to `projects.ts`, `route.ts`, `current-user.ts`, Prisma, or tests.
- Filter/search/sort are client-side only — no new endpoints.
- Existing passing tests must stay green (the 1 pre-existing billing-message test failure
  is out of scope).

## Files

- Rewrite: `globals.css`, `layout.tsx`, `page.tsx`, `create-project-form.tsx`,
  `upgrade-modal.tsx`.
- New: `theme-script.tsx`, `theme-toggle.tsx`, `user-switcher.tsx`, `stat-card.tsx`,
  `count-up.tsx`, `projects-panel.tsx`, `project-row.tsx`, `status-badge.tsx`,
  `toast.tsx`, plus `postcss.config.mjs` and Tailwind v4 wiring.
- Deps added: `tailwindcss`, `@tailwindcss/postcss`, `framer-motion`.
