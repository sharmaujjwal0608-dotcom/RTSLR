AGENT: 02 — UI/UX Design Director

ASSIGNED TASK:
Define and implement the RTSLR design system (tokens, root layout, UI primitives, live reference page,
specification) so the page-building agents can produce consistent pages without inventing styles.

OWNED FILES:
- frontend/src/app/globals.css
- frontend/src/app/layout.tsx
- frontend/src/app/page.tsx (temporary; Agent 01 replaces it)
- frontend/src/app/design-system/page.tsx
- frontend/src/components/ui/* (Button, Container, Section, Typography, Card, Badge, Notice, Tabs, Field, Slider, Reveal, ExternalLink, index.ts)
- frontend/src/lib/cn.ts
- docs/DESIGN_SYSTEM.md
- docs/agent-reports/AGENT_02.md

DEPENDENCIES:
- frontend/src/i18n/index.tsx (I18nProvider, used unchanged)
- Installed packages only: next 16.4.6 (next/font/google, next/link), tailwindcss 4.3.3, motion (motion/react), lucide-react. No packages added.

IMPLEMENTED FEATURES:
- Tailwind 4 CSS-first token system: `:root` variables mapped through `@theme inline`. The default Tailwind
  colour palette is removed (`--color-*: initial`), so only RTSLR tokens generate colour utilities.
- Colours: the eight starting values are unchanged. Added accent-ink, accent-soft, line-strong, on-ink, focus,
  and success/warning/danger/info each with `-ink` (text) and `-soft` (tint) variants.
- Ink tone: `[data-tone="ink"]` re-scopes the same variables, so all utilities and primitives invert inside
  `<Section tone="ink">` with no extra classes.
- Type scale with fluid clamp sizes (display, h1–h4, lead, body, small, caption, label), each carrying
  line-height, tracking and weight.
- Radius, shadow, container, spacing (gutter, section, section-tight, header), easing and one fade keyframe.
- Global focus-visible ring, selection colour, prefers-reduced-motion handling, Devanagari line-height and
  tracking rules for `:lang(hi)`.
- Root layout: Manrope + Noto Sans Devanagari + IBM Plex Mono via next/font/google, metadata title template
  "%s — RTSLR", `<html lang="en">`, skip link to `#main`, `<I18nProvider>`, marked `{/* SiteHeader */}` and
  `{/* SiteFooter */}` slots around `<main id="main">`, a `<noscript>` rule keeping `<Reveal>` content visible.
- Primitives: Button, Container, Section, Eyebrow, Heading, Lead, Card, Badge, StatusPill, Notice, Tabs, Field,
  Input, Select, Switch, Slider, Reveal, Kbd, VisuallyHidden, ExternalLink; all exported from
  `@/components/ui`.
- Live reference at `/design-system` showing every token and primitive with states, including the ink tone and a
  Hindi sample.
- docs/DESIGN_SYSTEM.md: tokens with contrast ratios, type scale, spacing, component API table, motion rules,
  layout specifications for Home, Product, Use Cases, Learn ISL, R&D, About and Studio, mobile specification,
  do/don't list.

FILES CREATED OR MODIFIED:
- Modified: frontend/src/app/globals.css, frontend/src/app/layout.tsx, frontend/src/app/page.tsx
- Created: frontend/src/app/design-system/page.tsx
- Created: frontend/src/lib/cn.ts
- Created: frontend/src/components/ui/{Button,Container,Section,Typography,Card,Badge,Notice,Tabs,Field,Slider,Reveal,ExternalLink}.tsx and index.ts
- Created: docs/DESIGN_SYSTEM.md, docs/agent-reports/AGENT_02.md

TESTS RUN:
1. `npx tsc --noEmit -p .` (from frontend/)
2. `npx eslint src/components/ui src/app src/lib/cn.ts` (from frontend/)
3. Token utility generation: compiled globals.css with the installed `@tailwindcss/node` `compile()` API from a
   throwaway script outside the repository and inspected the CSS generated for a list of candidate classes.
4. Contrast ratios: computed with a throwaway Node script using the WCAG 2.x relative-luminance formula.
- Not run: `next build`, `next dev`, Vitest, Playwright, any browser rendering. No visual check of the pages has
  been made by this agent; nothing has been seen in a browser.

TEST RESULTS:
1. tsc: no errors in Agent 02 files. Two errors reported, both in another agent's file
   (`src/features/recognition/models/islUserTemplates.ts` lines 371 and 373, readonly `candidates` not assignable
   to `RecognitionCandidate[]`).
2. eslint: no output (0 errors, 0 warnings) for the listed paths.
3. All token utilities generated as expected, for example `bg-background`, `bg-background-secondary`,
   `bg-surface`, `text-ink`, `text-muted`, `border-line`, `border-line-strong`, `text-accent`, `text-accent-ink`,
   `bg-accent-soft`, `text-success`, `text-danger-ink`, `bg-warning-soft`, `text-info-ink`, `text-on-ink`,
   `rounded-control/field/card/panel`, `shadow-soft/lift/float`, `font-sans/mono/hindi`, `text-display`,
   `text-h2`, `text-lead`, `text-label`, `max-w-reading/narrow/page/wide`, `px-gutter`, `py-section`,
   `py-section-tight`, `h-header`, `top-header`, `ease-calm`, `animate-fade-in`, `accent-ink`, `bg-ink/10`,
   `ring-focus`, and the variants used by the primitives. `bg-zinc-100` generated nothing, as intended.
   One finding fixed during the check: `max-w-prose` is a Tailwind built-in (65ch), so the reading container is
   named `max-w-reading`.
4. Contrast ratios are recorded in docs/DESIGN_SYSTEM.md section 2. Starting accent #D79C72 is 2.19:1 on cream
   and starting success #23855B is 4.26:1 on cream; both are restricted to non-text use and have `-ink` variants.

KNOWN LIMITATIONS:
- Not visually verified in a browser (dev server and build are forbidden for agents). Proportions, the fluid
  type sizes at real viewports and the Devanagari leading values are reasoned, not observed, and should be
  checked on first render.
- `cn()` does not resolve conflicting Tailwind classes; a `className` passed to a primitive cannot reliably
  override that primitive's own colour, padding or radius.
- The skip link text ("Skip to main content") and `ExternalLink`'s default screen-reader suffix are English;
  the layout is a server component. `ExternalLink` accepts `newTabLabel` for Hindi.
- No icon-only button, dialog, tooltip, toast, table or accordion primitive exists. They were out of the listed
  scope.
- `Button` with `href` has no disabled state (a link cannot be disabled); render a `<button disabled>` instead.
- Ghost-button hover, `StatusPill` border and other opacity modifiers rely on `color-mix()`, which Tailwind 4
  already requires.
- Removing the default palette means a class such as `text-zinc-500` or `bg-red-500` silently produces no CSS.

INTEGRATION NOTES:
- Agent 01: fill the `{/* SiteHeader */}` and `{/* SiteFooter */}` slots in `frontend/src/app/layout.tsx` and
  replace `frontend/src/app/page.tsx`. The header height token is `--header-height` (72px; utilities `h-header`,
  `top-header`); `html` already has matching `scroll-padding-top`. `<main id="main">` is a flex column with
  `flex-1`. Mobile navigation behaviour is specified in DESIGN_SYSTEM.md section 9.
- All page agents: import from `@/components/ui`; use only the token utilities; one `<h1>` per page (first
  `Section` with `titleAs="h1"` or a `Heading size="display"`); follow the per-page layout device in
  DESIGN_SYSTEM.md section 8.
- The temporary home page links to `/design-system` only, because no other route exists yet.
- `/design-system` sets `robots: { index: false }`; decide before launch whether it ships.
- The other agent's tsc errors in `src/features/recognition/models/islUserTemplates.ts` are unrelated to this
  work and were not touched.

STATUS: READY FOR REVIEW
