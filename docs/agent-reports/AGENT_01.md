# AGENT 01 report

```
AGENT: 01 — Frontend Architecture Engineer (pass 1: shell + Home, Product, Use Cases, About)

ASSIGNED TASK:
Application shell (SiteHeader, SiteFooter), the Home, Product, Use Cases and About pages, the
not-found / error / loading files, and the API fetch helper. The Studio UI is the next pass and was
not built.

OWNED FILES:
frontend/src/components/layout/**, frontend/src/components/home/**, frontend/src/components/marketing/**,
frontend/src/app/page.tsx, frontend/src/app/product/**, frontend/src/app/use-cases/**,
frontend/src/app/about/**, frontend/src/app/not-found.tsx, error.tsx, loading.tsx,
frontend/src/lib/api.ts, the two header/footer slots in frontend/src/app/layout.tsx,
docs/agent-reports/AGENT_01.md

DEPENDENCIES:
- @/components/ui (Agent 02), @/i18n (Agent 00), @/components/hero3d `HeroArtwork` (Agent 03).
- Routes /learn (Agent 09), /research (Agent 07): linked, exist on disk.
- Route /studio and /studio?demo=simulator: linked from the header, footer, hero and every closing
  call to action. THE ROUTE DOES NOT EXIST YET (my next pass). Until it does these links show the
  not-found page.
- Backend POST/DELETE /api/v1/feedback (Agent 04) for the About contact form.

IMPLEMENTED FEATURES:
- SiteHeader: sticky cream bar, hairline on scroll, six nav links with aria-current and ink underline,
  English/हिन्दी switch (useI18n), "Get Started" pill to /studio. Below lg: "Menu" button
  (aria-expanded, aria-controls) opening a full-screen sheet; focus moves in and is trapped (header bar
  + sheet), Esc closes and returns focus, body scroll locked, <main> and footer made inert, any route
  change closes it. usePathname is wrapped in Suspense (Next 16 cacheComponents rule).
- SiteFooter: navigation, capability statement, privacy line. No invented contact details, no year.
- Home: hero (exact headline and supporting copy, HeroArtwork in a fixed aspect-ratio box), "What works
  today" (Badges + warning Notice), product introduction, interactive 5-stage pipeline illustration
  (plays once in view, pause/replay, stages selectable, static under reduced motion), how-to steps,
  features, About ISL, previews of use cases / learn / R&D, privacy band, closing call to action.
- Product: schematic annotated studio diagram, capability table with status badges, camera/privacy
  does / does not, dual-hand explanation with (1) explorable 21-landmark hand diagram and a 156-D
  composition bar, (2) hold-to-append timing demo using the stabiliser defaults (8-frame vote, 4 votes,
  1.2 s hold, 1 s cooldown, 300 ms release, commit once per hold), language limits, spec table.
- Use Cases: six alternating rows (scenario, can do today, cannot yet, suitability badge), danger
  Notice at the top and an ink "must not be used" band.
- About: mission, motivation, vision, journey timeline, principles, team marked as unfinished content,
  contact = FeedbackForm.
- FeedbackForm + lib/api.ts: POST FeedbackIn with consent:true and consentVersion "1", shows id and
  deletion token once, copy token, delete now (DELETE with X-Deletion-Token), distinct messages for
  network / timeout / 429 / 400-413-422 / other, replaced by a Notice when NEXT_PUBLIC_API_BASE_URL is
  unset. Requests use credentials "omit" and referrerPolicy "no-referrer".
- All interface text in English and Hindi via defineMessages/useMessages. Page files are server
  components exporting metadata.

FILES CREATED OR MODIFIED:
Created
  frontend/src/lib/api.ts
  frontend/src/components/layout/{navigation.ts,LanguageSwitch.tsx,SiteHeader.tsx,SiteFooter.tsx,SystemPages.tsx,index.ts}
  frontend/src/components/home/{HomePage.tsx,homeMessages.ts,PipelineDemo.tsx}
  frontend/src/components/marketing/{handGeometry.tsx,TextLink.tsx,ClosingCta.tsx,HandLandmarkExplorer.tsx,
    HoldToAppendDemo.tsx,FeedbackForm.tsx,ProductPage.tsx,productMessages.ts,UseCasesPage.tsx,AboutPage.tsx}
  frontend/src/app/{product,use-cases,about}/page.tsx
  frontend/src/app/{not-found.tsx,error.tsx,loading.tsx}
Modified
  frontend/src/app/page.tsx (replaced the temporary page)
  frontend/src/app/layout.tsx (two imports; SiteHeader / SiteFooter slots filled; nothing else)

TESTS RUN:
- `npx tsc --noEmit -p .` (frontend/)
- `npx eslint` on all files listed above
- Unit tests: not written, not run. Browser: not run (dev server and build are not allowed in this pass).

TEST RESULTS:
- tsc: exit 0, no errors in the whole project at the time of the run.
- eslint: exit 0, no errors or warnings on my files.
- Nothing was rendered in a browser. Layout, motion, focus behaviour, Hindi wrapping and the feedback
  round trip are unverified.

KNOWN LIMITATIONS:
- /studio does not exist yet, so the main call to action currently 404s.
- The Product "annotated studio" is a schematic drawn from the design-system Studio spec, not a
  screenshot; it must be checked against the real Studio after the next pass.
- Capability statuses marked "Implemented" (dual-hand tracking, 156-D features, text output) are taken
  from the code and contracts in the repository; I did not run those modules.
- Statements about ISL follow docs/RESEARCH_NOTES.md section 1 (own language, two-handed
  fingerspelling, meaning beyond the hands). No statistics are quoted.
- Capability table: below md the rows use display:flex, which can drop table semantics in some
  screen readers.
- The landmark explorer uses SVG elements with role="radio"; focus-ring rendering on SVG groups
  varies by browser (a visible halo is drawn as well).
- The skip link in layout.tsx is English only (not my file).
- A root loading.tsx adds a Suspense boundary around every route, including other agents' pages.

INTEGRATION NOTES:
- Design system gaps: no Textarea, no Checkbox, no icon-only button; StatusPill and Badge are
  nowrap with fixed height so long or Hindi status text cannot wrap (I used a compact Notice instead);
  Button does not accept `ref` in its types; no keyframes for anything beyond a fade.
- FEEDBACK_CONSENT_VERSION is "1" (backend default). SECURITY_PRIVACY BE-23 asks for the consent text
  of each version to be kept in the repository: the text shown is the `consent` message in
  components/marketing/FeedbackForm.tsx and should be recorded there by the owner of that document.
- The Product page tells users that the hand-tracking model file may be downloaded from Google's
  MediaPipe storage (the default in next.config.ts). If the model is self-hosted, that sentence can go.
- Studio must honour `?demo=simulator` (constant SIMULATOR_DEMO_HREF in components/layout/navigation.ts).
- Team names and a contact address are deliberately absent; the project owner must supply them.

STATUS: READY FOR REVIEW
```
