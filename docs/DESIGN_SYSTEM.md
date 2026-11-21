# RTSLR design system

Owner: Agent 02. Source of truth: `frontend/src/app/globals.css` (tokens) and `frontend/src/components/ui/` (primitives).
Live reference: `/design-system` (`frontend/src/app/design-system/page.tsx`).

The look: warm cream page, very large black headline set tight, white sheets with hairline edges, fully rounded
black controls, one clay accent used as a mark, warm low shadows, a lot of air. Light theme only. The page must
look finished with every animation switched off.

**Rule zero for page agents:** build with the primitives and the token utilities below. Do not add colours,
font sizes, radii, shadows or keyframes. If something is missing, say so under INTEGRATION NOTES.

---

## 1. Fonts

| Role | Family | CSS variable | Utility |
| --- | --- | --- | --- |
| Latin interface and headlines | **Manrope** (variable, 200–800) | `--font-manrope` | `font-sans` (default on `html`) |
| Hindi | **Noto Sans Devanagari** (variable) | `--font-devanagari` | inside `font-sans`; force with `font-hindi` |
| Technical readouts | **IBM Plex Mono** 400/500 | `--font-plex-mono` | `font-mono` |

All three load through `next/font/google` in `layout.tsx` (self-hosted, no runtime request to Google).
The Devanagari face is inside the `font-sans` stack, so Hindi glyphs fall through to it automatically and Latin
words such as "RTSLR" and "ISL" stay in Manrope. Use `font-mono` only for machine output (landmark counts, model
ids, fps, key names), never for ordinary labels.

## 2. Colour tokens

Colour utilities exist **only** for these tokens. The default Tailwind palette (`zinc`, `slate`, `red-500`, …)
is removed with `--color-*: initial`; `bg-zinc-100` generates nothing. `white`, `black`, `transparent`,
`current` and `inherit` still work. Opacity modifiers work on every token (`bg-ink/8`, `border-ink/15`).

Every token works with every colour utility: `bg-*`, `text-*`, `border-*`, `ring-*`, `outline-*`, `fill-*`,
`stroke-*`, `decoration-*`, `accent-*`, `divide-*`.

| Token | Hex | Typical utility | Use |
| --- | --- | --- | --- |
| `background` | `#FAF6F0` | `bg-background` | Page |
| `background-secondary` | `#F2EBE2` | `bg-background-secondary` | Alternate band, wells, disabled fill |
| `surface` | `#FFFFFF` | `bg-surface` | Cards, inputs, panels |
| `ink` | `#101010` | `text-ink`, `bg-ink`, `border-ink` | Headings, body, primary controls |
| `muted` | `#686662` | `text-muted` | Secondary text |
| `on-ink` | `#FAF6F0` | `text-on-ink` | Text on a `bg-ink` fill |
| `line` | `#E5DED5` | `border-line` | Hairlines, card edges (decorative) |
| `line-strong` | `#8C857B` | `border-line-strong` | Form control borders |
| `accent` | `#D79C72` | `bg-accent`, `text-accent` (icons/large marks only) | Marks, rules, illustration |
| `accent-ink` | `#8A4F24` | `text-accent-ink` | Accent as text |
| `accent-soft` | `#F6E6D8` | `bg-accent-soft` | Tint behind `ink`/`accent-ink` text |
| `success` | `#23855B` | `bg-success`, `text-success` (icons/large only) | Dots, icons |
| `success-ink` / `success-soft` | `#1A6B48` / `#E1F1E8` | `text-success-ink`, `bg-success-soft` | Status text / tint |
| `warning` | `#B97A09` | `bg-warning` | Dots, icons |
| `warning-ink` / `warning-soft` | `#7A4F00` / `#FAEBC8` | `text-warning-ink`, `bg-warning-soft` | Status text / tint |
| `danger` | `#C8372B` | `bg-danger` | Dots, icons |
| `danger-ink` / `danger-soft` | `#A8261C` / `#FBE4E0` | `text-danger-ink`, `bg-danger-soft` | Status text / tint |
| `info` | `#3B72A6` | `bg-info` | Dots, icons |
| `info-ink` / `info-soft` | `#28557F` / `#E2ECF5` | `text-info-ink`, `bg-info-soft` | Status text / tint |
| `focus` | `#101010` | `outline-focus`, `ring-focus` | Focus ring (applied globally) |

### Contrast (WCAG 2.x, computed)

AA needs 4.5:1 for text, 3:1 for large text (24px+, or 18.66px+ bold) and for UI component boundaries.

| Foreground | on `background` | on `background-secondary` | on `surface` | Verdict |
| --- | --- | --- | --- | --- |
| `ink` #101010 | 17.67 | 16.09 | 19.03 | AAA |
| `muted` #686662 | 5.32 | 4.84 | 5.73 | AA text |
| `accent-ink` #8A4F24 | 6.05 | 5.51 | 6.51 | AA text |
| `success-ink` #1A6B48 | 6.02 | 5.48 | 6.48 | AA text |
| `warning-ink` #7A4F00 | 6.62 | 6.03 | 7.13 | AA text |
| `danger-ink` #A8261C | 6.59 | 6.00 | 7.10 | AA text |
| `info-ink` #28557F | 7.23 | 6.59 | 7.79 | AA text |
| `line-strong` #8C857B | 3.39 | 3.08 | 3.65 | AA for control borders |
| `success` #23855B | 4.26 | 3.88 | 4.59 | **Fails for body text** on cream: icons, dots, large text only |
| `accent` #D79C72 | 2.19 | 2.00 | 2.36 | **Fails**: decorative marks only, never text or a required boundary |
| `line` #E5DED5 | 1.24 | 1.13 | 1.33 | Decorative only: never the sole boundary of a control |

| Pair | Ratio |
| --- | --- |
| `on-ink` #FAF6F0 on `ink` #101010 (primary button) | 17.67 |
| `accent-ink` on `accent-soft` | 5.34 |
| `success-ink` on `success-soft` | 5.54 |
| `warning-ink` on `warning-soft` | 6.04 |
| `danger-ink` on `danger-soft` | 5.84 |
| `info-ink` on `info-soft` | 6.51 |
| `ink` on any `*-soft` tint | 15.6 – 16.3 |
| `ink` #101010 on `accent` #D79C72 | 8.05 |

`muted` is **not** checked on the `*-soft` tints: inside a Notice or Badge use `text-ink` or the matching `*-ink`.

Changes from the starting palette: none of the eight starting values changed. Added `accent-ink` (the starting
accent is 2.19:1 on cream), `success-ink` (the starting success is 4.26:1 on cream), `line-strong` (the starting
border is 1.24:1, too faint for input boundaries), plus the warning, danger, info and soft tints.

### Ink tone

`<Section tone="ink">` sets `data-tone="ink"`, which re-scopes the same variables. Inside it every utility keeps
working with inverted meaning, so you write the same classes as on cream.

| Token inside ink | Value | Ratio on ink background #101010 |
| --- | --- | --- |
| `background` / `background-secondary` / `surface` | #101010 / #1A1917 / #211F1D | – |
| `ink` | #FAF6F0 | 17.67 (15.26 on surface) |
| `muted` | #B4AEA5 | 8.64 (7.46 on surface) |
| `accent-ink` | #E0AA82 | 9.28 |
| `success-ink` / `warning-ink` / `danger-ink` / `info-ink` | #6FCB9F / #E9B949 / #F29A8E / #8DBBE6 | 9.71 / 10.42 / 8.87 / 9.41 |
| `*-ink` on its `*-soft` tint | – | 6.69 – 7.37 |
| `line-strong` | #8C857B | 5.22 |

Shadows are `none` inside ink. Use at most one ink section per page (usually the closing call to action or the
privacy statement). It is an inverse band, not a dark theme.

## 3. Type scale

Each size utility sets font-size, line-height, letter-spacing and weight together. Do not add `leading-*`,
`tracking-*` or `font-*` on top of the heading sizes.

| Utility | Size (375px → 1440px+) | Line height | Tracking | Weight | Use |
| --- | --- | --- | --- | --- | --- |
| `text-display` | 44 → 108px `clamp(2.75rem, 1.35rem + 6.2vw, 6.75rem)` | 0.98 | −0.045em | 700 | One hero headline per page at most |
| `text-h1` | 36 → 64px | 1.04 | −0.035em | 700 | Page title on inner pages |
| `text-h2` | 28 → 44px | 1.1 | −0.03em | 650 | Section title |
| `text-h3` | 20 → 24px | 1.25 | −0.015em | 650 | Sub-section, feature title |
| `text-h4` | 17px | 1.4 | −0.005em | 650 | Card title, panel title |
| `text-lead` | 17 → 21px | 1.55 | 0 | 400 | Intro paragraph |
| `text-body` | 16px | 1.65 | 0 | 400 | Paragraphs |
| `text-small` | 14px | 1.55 | 0 | – | Buttons, labels, dense copy |
| `text-caption` | 13px | 1.45 | 0 | – | Hints, captions, metadata |
| `text-label` | 12px | 1.35 | +0.02em | – | Badges, mono readouts. Smallest size allowed |

Rules: headlines in sentence case, never all caps, no tracked-out uppercase labels. Line length under 75
characters (`Lead` caps itself at 60ch; use `max-w-reading` for prose). Headings use `text-wrap: balance`,
paragraphs `pretty`. Emphasis inside a headline is not coloured or italicised.

### Hindi

`I18nProvider` sets `<html lang="hi">`. Then, automatically: body line-height becomes 1.8; `text-display` and
`text-h1` get 1.24, `text-h2` 1.3, `text-h3`/`text-h4` 1.45, text sizes 1.8; negative tracking is reset to 0
(tight tracking collides matras and breaks the shirorekha). For a Hindi phrase inside an English page wrap it in
`<span lang="hi">`. Expect Hindi strings to run 10–30% longer than English: never fix a width or height around
text, and let buttons wrap in a `flex-wrap` row.

## 4. Space, shape, elevation

Spacing uses the Tailwind 4px scale plus four tokens:

| Utility | Value | Use |
| --- | --- | --- |
| `px-gutter` (also `gap-gutter`, …) | 20 → 48px | Page side padding (built into `Container`) |
| `py-section` | 72 → 144px | Section rhythm (built into `Section`) |
| `py-section-tight` | 48 → 88px | Dense or utility sections (`spacing="tight"`) |
| `h-header`, `top-header`, `pt-header` | 72px (`--header-height`) | Site header height, sticky offsets |

Inside a section: 48–64px between header and content (`Section` does it), 32–48px between blocks, 16–24px
inside a group, 8–12px between a label and its control. Prefer steps 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24.

| Container | Utility | Width |
| --- | --- | --- |
| `reading` | `max-w-reading` | 672px, prose |
| `narrow` | `max-w-narrow` | 960px, forms and articles with a side note |
| `page` (default) | `max-w-page` | 1280px |
| `wide` | `max-w-wide` | 1472px, Studio and full-bleed heroes |

| Radius utility | Value | Use |
| --- | --- | --- |
| `rounded-control` | pill | Buttons, badges, pills, tab lists, switches |
| `rounded-field` | 14px | Inputs, selects, compact notices |
| `rounded-card` | 20px | Cards, notices, media |
| `rounded-panel` | 32px | Hero-scale panels, the Studio stage |

| Shadow utility | Use |
| --- | --- |
| `shadow-soft` | Primary button at rest, small floating chips |
| `shadow-lift` | `Card variant="raised"`, button hover, sticky toolbars |
| `shadow-float` | The single hero object of a page (3D sculpture plinth, Studio stage) |

Shadows are warm brown (`rgb(74 52 30 / …)`), never grey or coloured. Most surfaces have **no** shadow: a hairline
`border-line` is the default edge.

## 5. Motion

- Easing `ease-calm` (`cubic-bezier(0.22, 0.61, 0.36, 1)`); durations 200ms for state changes, 600ms for `Reveal`.
- One orchestrated moment per page (usually the hero). `Reveal` on a few key blocks only, never on every
  section, never on body text the user is waiting to read. Stagger siblings by 0.06–0.12s.
- Motion that answers an action (tab change, switch, pressed button) is welcome; ambient loops are not.
  No parallax, particles, glows, gradient sweeps or cursor followers.
- 3D (Home hero): slow, low-amplitude idle drift only; it must render a still frame under reduced motion.
- `prefers-reduced-motion: reduce` is handled globally: all CSS animation/transition durations collapse,
  smooth scrolling is off, and `[data-reveal]` is forced visible. For `motion/react` or R3F animation you
  write yourself, check `useReducedMotion()` and render the final state.
- Content is never hidden behind animation: `[data-reveal]` is also forced visible in print and inside
  `<noscript>`.

## 6. Focus, selection, states

- Focus: global `:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px }`. Do not remove or
  restyle it. It inverts automatically in ink sections.
- Selection: clay background, black text.
- Hover never carries information on its own. Disabled is 45–60% opacity plus the `disabled` attribute.
- Status is always words plus an icon or dot (`Badge`, `StatusPill`, `Notice`), never colour alone.
- Live status changes: `StatusPill live`, `Notice live="polite"` or your own `aria-live` region.

## 7. Components

Import from `@/components/ui`. Server components unless marked **client**. `className` is appended, not merged:
use it for layout (margin, width, grid placement), not to override a primitive's colour, padding or radius.

| Component | Props (defaults in bold) |
| --- | --- |
| `Button` | `variant` **primary** \| secondary \| ghost · `size` sm (36px) \| **md** (44px) \| lg (56px) · `icon` (trailing) · `leadingIcon` · `fullWidth` · `href` (renders Next `<Link>`; otherwise `<button type="button">`) · all button/Link props |
| `Container` | `size` reading \| narrow \| **page** \| wide · `as` |
| `Section` | `tone` **cream** \| secondary \| surface \| ink · `eyebrow` · `title` · `lead` · `titleAs` h1 \| **h2** \| h3 · `titleSize` · `align` **start** \| center · `aside` · `spacing` **default** \| tight \| none · `container` · `contained` (**true**) · section props (`id`, …) |
| `Heading` | `size` display \| h1 \| **h2** \| h3 \| h4 · `as` (defaults to the tag matching size; display → h1) |
| `Eyebrow` | `as` **p** \| span \| div. Sentence case with a short clay rule |
| `Lead` | paragraph props. Muted, 60ch |
| `Card` | `variant` **outline** \| sunken \| raised · `padding` none \| sm \| **md** \| lg · `panel` (32px corner) · `as` |
| `Badge` | `tone` **neutral** \| success \| warning \| danger \| info · `icon` (replaces dot) · `plain` (no dot, neutral only) |
| `StatusPill` | `tone` (same five) · `icon` (default icon per tone) · `live` (role="status") |
| `Notice` | `tone` neutral \| success \| warning \| danger \| **info** · `title` · `icon` · `live` polite \| assertive · `compact` · `actions` |
| `Tabs` **client** | `items: { id, label, icon?, content, disabled? }[]` · `label` (required accessible name) · `value` / `defaultValue` / `onValueChange` · `variant` **pill** \| underline · `panelClassName` |
| `Field` | `label` · `htmlFor` · `hint` · `error` · `labelAside` (for custom controls) |
| `Input` | `label` (required) · `hint` · `error` · `labelAside` · all input props |
| `Select` | `label` (required) · `options: { value, label, disabled? }[]` or `<option>` children · `hint` · `error` · select props |
| `Switch` | `label` (required) · `hint` · `checked`/`onChange` or `defaultChecked` · input props. Native checkbox with `role="switch"` |
| `Slider` **client** | `label` (required) · `min` **0** · `max` **100** · `step` **1** · `value` / `defaultValue` / `onValueChange(number)` · `unit` · `formatValue` · `hint` |
| `Reveal` **client** | `delay` (s) · `y` (**14**px) · `as` **div** \| section \| li \| span |
| `Kbd` | kbd props |
| `VisuallyHidden` | `as` **span** \| div \| p \| h2 \| h3 |
| `ExternalLink` | `href` · `newTabLabel` (**"opens in a new tab"**; pass Hindi from messages) · `hideIcon`. Always `target="_blank" rel="noopener noreferrer"` |

Also exported: all prop types, `Tone`, `TabItem`, `SelectOption`. `cn()` lives in `@/lib/cn`.

### Usage

```tsx
import { ArrowUpRight, Play } from "lucide-react";
import { Badge, Button, Card, Heading, Notice, Section, StatusPill } from "@/components/ui";

<Section tone="secondary" eyebrow="Privacy" title="Your camera stays on your device"
         lead="Frames are processed in the browser and never uploaded.">
  <div className="grid gap-8 lg:grid-cols-12">
    <Card className="lg:col-span-7">…</Card>
    <div className="lg:col-span-5">…</div>
  </div>
</Section>

<Button href="/studio" size="lg" icon={<ArrowUpRight />}>Try live translation</Button>
<Button variant="secondary" size="lg" icon={<Play />} onClick={openDemo}>Watch demo</Button>

<Notice tone="warning" title="Experimental">No validated ISL model exists yet.</Notice>
<StatusPill tone="success" live>Hand detected</StatusPill>
<Badge tone="info">Simulator</Badge>
```

```tsx
"use client";
<Tabs label="Recognition source" items={[
  { id: "camera", label: t.camera, content: <CameraPanel /> },
  { id: "simulator", label: t.simulator, content: <SimulatorPanel /> },
]} />
<Slider label={t.threshold} value={threshold} onValueChange={setThreshold} unit="%" />
<Switch label={t.mirror} checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
```

Notes:

- `Button` always has a visible text label. There is no icon-only variant: if a page needs one (for example a
  close button), request it under INTEGRATION NOTES rather than styling a bare `<button>`.
- Icons come from `lucide-react` only, at the default 2px stroke. The primitives size them; do not set sizes on
  icons passed to `icon`/`leadingIcon`.
- `Section` labels itself with its `title` (`aria-labelledby`). A page has one `<h1>`: give the first section
  `titleAs="h1"`, or render your own `<Heading size="display">` (which is an `h1` by default).
- Server pages can pass JSX into `Tabs` items. `Slider.formatValue` is a function, so use it from client
  components only (`unit` covers the common case).
- An action keeps one name everywhere: the button "Start camera" leads to the status "Camera on".

## 8. Page layouts

Shared frame: `SiteHeader` (72px, sticky, cream with a hairline that appears on scroll) → `<main id="main">` →
`SiteFooter`. Grid: 12 columns from `lg`, `gap-8` (32px), `gap-12` between major halves. Body text is left
aligned everywhere; centre only a short closing call to action.

Each page has its own signature layout device. Do not reuse another page's device, and do not fall back to
a three-up card grid.

### Home: the composed still life

1. **Hero** (cream, min-height `calc(100svh - header)`): 12-col. Columns 1–7: `Heading size="display"`
   "Turn signs into conversations." (max 12ch), `Lead`, two `Button size="lg"` (primary "Try live translation"
   with ArrowUpRight → `/studio`; secondary "Watch demo" with Play, rendered only if a real demo exists). Columns
   7–12: the ivory 3D hand sculpture with ribbon and geometric forms, overlapping the headline column slightly,
   with `shadow-float` grounding. The sculpture is a neutral open hand: it must not depict a specific sign.
   Fallback: a static render/poster in the same position (no WebGL, reduced motion).
2. **Honesty strip** (same cream, directly under the hero): one compact `Notice` stating what is real today.
3. **How it works** (secondary): a true 3-step sequence (camera → landmarks → result) as one horizontal line
   diagram with numbered stops; text under each stop. Numbers are allowed here because it is a sequence.
4. **Three areas** (cream): Studio, Learn ISL, R&D as an asymmetric editorial split: one large feature (7 cols)
   plus two stacked rows (5 cols) separated by hairlines, not three equal cards.
5. **Privacy statement** (ink): one large sentence (`text-h1`) plus three short facts in a row.
6. **Closing CTA** (cream, centred, `spacing="tight"`).

### Product: the annotated specimen

Device: one large product visual with numbered callouts, then a specification table.

1. Header (`titleAs="h1"`, `text-h1`, left) with a `StatusPill` giving the current honest state.
2. Annotated interface: a wide `rounded-panel` Studio still (8 cols) with a hairline-ruled list of
   annotations (4 cols) that stays sticky while the visual scrolls.
3. Capabilities as a **definition table**: rows separated by `border-line`, columns "What", "How it works",
   "Status" (Badge). No cards.
4. Limits and non-goals (secondary): a plain two-column list, "Does" / "Does not".
5. Technical requirements (surface): mono readouts in a `Card variant="sunken"`.
6. CTA.

### Use Cases: the alternating narrative

Device: full-width alternating rows, one scenario per row.

1. Header with lead.
2. Four to five scenario rows: each is a 12-col split (text 5 / illustration or quote 7) that flips sides
   row by row, separated by generous space and a hairline. Each row ends with a "Suitable today?" line using a
   `Badge` (e.g. "Exploratory"), never implying validated use.
3. "Where it must not be used" (ink or `Notice tone="danger"` block): medical, legal, emergency.
4. CTA.

### Learn ISL: the index and the study card

Device: a browsable index with a filter rail; the only page where a uniform grid is right, because items are a
collection.

1. Header with a search `Input` and category `Tabs variant="underline"`.
2. Left rail (3 cols, sticky at `top-header`): categories and a progress summary. Right (9 cols): lesson index
   as a **list with rows** on mobile and a 2–3 column grid of compact `Card padding="sm"` from `md`.
   Each item: title, category `Badge`, source state (`Badge tone="success"` "Verified source" or
   `tone="warning"` "Pending verified source"). No sign media or handshape description without a cited source.
3. Lesson detail: `Container size="narrow"`, media stage on top (`rounded-panel`, 16:9), text below at
   `max-w-reading`, source citation as `ExternalLink`.
4. Practice entry point linking to the Studio.

### R&D: the lab notebook

Device: a document layout with a sticky table of contents and mono metadata; the densest, most text-led page.

1. Header: `text-h1`, lead, "Last updated" in `font-mono text-label`.
2. Two-column document: sticky contents (3 cols) + article (`max-w-reading`, 7 cols) + margin notes (2 cols,
   hidden below `xl`).
3. Sections: approach, pipeline diagram (hairline boxes and arrows, no shadows), datasets (table with a
   "Status" column), open problems (plain ordered list), roadmap as a vertical timeline with a single rule.
4. Every metric cell is either a measured value with its source or the word "Not measured". Use
   `Notice tone="warning"` at the top: no validated ISL model.

### About: the letter

Device: a single narrow column, almost no chrome.

1. Large statement (`text-h1`, max 18ch) in `Container size="narrow"`.
2. Mission prose at `max-w-reading`, with one pull quote set in `text-h2` breaking out to the narrow width.
3. Principles as a hairline-separated list with a title column (4) and text column (8).
4. Team/credits and contact as plain text rows. Closing ink band optional (only if Home's is the only other).

### Studio: the instrument

Device: an application workspace, not a marketing page. `Container size="wide"`, `Section spacing="none"` with
its own `py-6`; almost no scroll on desktop.

- Desktop (`lg`+): 12-col. **Stage** (cols 1–8): camera/landmark canvas in a `rounded-panel` `bg-ink` frame with
  `shadow-float`, 4:3 or 16:9, status row overlaid at the top (`StatusPill live`), primary transport below
  ("Start camera" / "Stop camera", `Button size="lg"`). **Side panel** (cols 9–12): `Card variant="outline"`
  holding `Tabs` (Result · Settings · Templates). Result shows the current label in `text-h1`, the candidate
  list as rows with a mono score and a text bar, and the transcript.
- A persistent compact `Notice tone="warning"` above the stage states which model is running
  ("Simulator", "Legacy ASL prototype", "Your recorded templates") and that it is not validated ISL recognition.
- Camera never starts on load: the stage shows an empty state with the "Start camera" button and a one-line
  privacy statement.
- Settings use `Switch`, `Slider`, `Select`; `Button size="sm"` is allowed in the stage toolbar only.
- Numbers that update live use `font-mono` (tabular figures) so the layout does not jitter.

## 9. Mobile

| Breakpoint | Width | Behaviour |
| --- | --- | --- |
| base | < 640px | One column. Gutter 20px. Section padding 72px. Buttons in a hero stack full width (`fullWidth`) |
| `sm` | ≥ 640px | Buttons sit side by side; two-column lists allowed |
| `md` | ≥ 768px | Two-column splits; section header and `aside` sit on one line |
| `lg` | ≥ 1024px | 12-column grid, sticky rails, desktop navigation, Studio side panel |
| `xl` | ≥ 1280px | Margin notes (R&D), max hero type |

- **Navigation**: below `lg` the header shows the RTSLR wordmark, the language switch and a "Menu" button
  (text label, not only an icon). It opens a full-screen cream sheet below the header: links stacked at
  `text-h2`, "Get started" as a full-width primary button at the bottom. Requirements: `aria-expanded` and
  `aria-controls` on the button, focus moves into the sheet and is trapped, `Esc` and route change close it,
  body scroll is locked, focus returns to the button. From `lg`: inline links (`text-small font-semibold`),
  current page marked with `aria-current="page"` and an ink underline, "Get started" as `Button size="md"`.
- **Touch targets**: 44×44px minimum. `Button` md/lg, inputs (48px), tabs (40px inside a 48px list), switch rows
  (44px) already comply. `Button size="sm"` (36px) is desktop Studio toolbars only; on touch layouts use `md`.
  Keep 8px between adjacent targets.
- **Hero on mobile**: headline first, then lead and buttons, then the sculpture at reduced height (max 60vw)
  below the fold line; never behind the text.
- **Studio on mobile**: stage first at full width, transport button directly under it, the side panel becomes
  the tabbed area below. The honesty notice stays above the stage.
- **Tables** (Product, R&D): below `md` each row becomes a stacked definition block; do not scroll sideways
  except for genuinely tabular data, and then inside a focusable `overflow-x-auto` region with a label.
- No horizontal page scroll at 320px. Test Hindi at 320px: long words must wrap (`break-words` on headings
  where needed).
- Use `svh`/`dvh`, not `vh`, for full-height areas.

## 10. Do / Don't

**Do**

- Start every band with `Section`, every column with `Container`.
- Let the headline be the loudest thing; keep one accent mark per view.
- Use hairlines and whitespace to separate; reach for a `Card` only to group.
- Pair every status colour with an icon and words.
- Write sentence-case labels that say what happens: "Start camera", "Save template".
- State limits plainly with `Notice`: experimental, simulator, legacy ASL, pending verified source.
- Check each page with reduced motion on, at 320px, in Hindi, and by keyboard alone.

**Don't**

- Don't use purple, gradients as decoration, neon, glows, glass/blur panels, blobs or particles.
- Don't add hex colours, arbitrary `text-[…]` sizes, arbitrary shadows or new keyframes.
- Don't build a page from rows of identical cards, or put shadows on everything.
- Don't use `accent` (#D79C72) or `success` (#23855B) for body text; use the `-ink` variants.
- Don't use `text-muted` on a `*-soft` tint.
- Don't set all-caps tracked labels, or colour a single word in a headline.
- Don't use more than one `text-display` or more than one ink section per page.
- Don't render a control that does nothing, a link without a destination, or a number you did not measure.
- Don't depict or describe how an ISL sign is formed without a cited source, including in illustration and 3D.
- Don't hide content until an animation runs, and don't animate every section on scroll.
