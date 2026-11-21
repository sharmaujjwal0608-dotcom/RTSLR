AGENT: 03 — 3D Graphics and Motion Engineer

ASSIGNED TASK:
Home hero artwork: a premium ivory, hand-inspired 3D sculpture on the cream page, with ribbons, floating
geometric forms and interface-symbol chips; static fallback; motion; performance and accessibility rules.

OWNED FILES:
- frontend/src/components/hero3d/**
- docs/agent-reports/AGENT_03.md

DEPENDENCIES:
- three 0.187, @react-three/fiber 9, @react-three/drei 10 (Environment with children, Lightformer, RoundedBox
  only: none of these make network requests), next/dynamic, `@/lib/cn`.
- Tailwind utilities from the design system: `ease-calm`, standard layout/opacity/transition utilities.
- No new packages. No static assets were added (nothing under frontend/public/images/hero/).

IMPLEMENTED FEATURES:
- `HeroArtwork` (no required props, fills its parent's box; optional `className`, `mode="auto" | "static"`).
- Procedural hand (`Hand.tsx`): superellipsoid palm with wrist taper, thumb pad and shallow hollow; five fingers
  of three tapered phalanges with sphere joints and elongated tips; flattened wrist. Neutral relaxed open hand,
  stated in code comments and README as not depicting any sign; fingers are never animated.
- Material and light: ivory `MeshPhysicalMaterial` (clearcoat + sheen), key (shadow-casting) + warm rim + fill
  directional lights, hemisphere light, procedural environment from three Lightformers and a dome rendered once
  into a 128px cube, `NeutralToneMapping`, baked radial-gradient ground shadow.
- Two Catmull-Rom tube ribbons (clay, ivory), five floating solids (clay sphere, ivory torus, ink rounded box,
  two small dots), three chips (speech bubble, "Aa" with cursor, waveform) drawn to canvas textures. The "Aa"
  glyphs use the page's already-loaded font stack; nothing is fetched.
- Motion: group entrance, slow idle drift, per-piece staggered entrance and drift, pointer parallax (mouse only,
  passive window listener, eased, max 0.14 rad), scroll response over the first viewport height. All off under
  `prefers-reduced-motion`: one still frame with `frameloop="demand"`.
- Performance: 3D in a `next/dynamic` chunk (`ssr: false`), requested only on capable devices once the artwork
  is within 200px of the viewport; `dpr` capped at 1.5; render loop stops when off-screen (IntersectionObserver)
  or when the tab is hidden; hand-made geometries, textures and materials disposed on unmount.
- Fallback: inline SVG illustration of the same composition, server-rendered, always painted first; 3D
  cross-fades in over it after the first frame. Used alone on width < 768px, low-power touch devices, <= 2
  cores, data-saver, no WebGL2, render error (error boundary) and context loss.
- Accessibility: `aria-hidden`, nothing focusable, `pointer-events: none` on the whole box.
- Exported helpers: `usePrefersReducedMotion`, `useParallax`, `useMediaQuery`, `useInView`, `usePageVisible`,
  `useHero3DCapable`, `canUseWebGL`, `HeroFallback`.
- README with structure, tuning table, fallback rules and GLB swap steps.

FILES CREATED OR MODIFIED:
- frontend/src/components/hero3d/index.ts
- frontend/src/components/hero3d/HeroArtwork.tsx
- frontend/src/components/hero3d/HeroFallback.tsx
- frontend/src/components/hero3d/HeroScene.tsx
- frontend/src/components/hero3d/Hand.tsx
- frontend/src/components/hero3d/Forms.tsx
- frontend/src/components/hero3d/hooks.ts
- frontend/src/components/hero3d/config.ts
- frontend/src/components/hero3d/README.md
- docs/agent-reports/AGENT_03.md

TESTS RUN:
- `npx tsc --noEmit -p .` (frontend/)
- `npx eslint src/components/hero3d` (frontend/)
- Visual check outside Next: `HeroScene` and `HeroFallback` bundled with the installed Vite into a throwaway
  harness in the session scratch directory (nothing written to the repository), served from a temporary local
  static server on 127.0.0.1:4791 (stopped afterwards) and viewed in a 600 x 600 box on the cream background,
  in both animated and reduced-motion (still) modes.
- No unit tests were written. Playwright: not run. `next build` / `next dev`: not run (forbidden by the brief).

TEST RESULTS:
- tsc: 0 errors in the whole project at the time of the run.
- eslint on src/components/hero3d: exit code 0, no errors or warnings.
- Harness: scene and SVG both rendered; no console errors; one console warning from three.js
  ("THREE.Clock: This module has been deprecated. Please use THREE.Timer instead."), which comes from
  @react-three/fiber's internal clock, not from this code. Lighting was tuned from these screenshots (the first
  pass was clearly under-exposed).

KNOWN LIMITATIONS:
- Not seen inside the real Home page: `HeroArtwork` itself (next/dynamic loading, the cross-fade, the
  capability rule, IntersectionObserver pausing, the error boundary, context-loss handling) was not executed in
  a browser. Only `HeroScene` and `HeroFallback` were.
- Not exercised: pointer parallax, scroll response, mobile and touch devices, non-square boxes, Hindi locale,
  real frame rate, memory after unmount.
- The hand is a stylised mannequin-like form built from primitives: phalanx boundaries are faintly visible as
  tonal steps at the joints, and there are no nails or creases. A sculpted GLB would look more refined.
- The 3D hand is slightly larger and more turned than the hand in the SVG, so the cross-fade is a soft change
  rather than a perfect match.
- Chip faces render slightly warmer than pure white under the scene lighting.
- The design system says "no parallax"; the task asked for small pointer parallax. It is implemented at low
  amplitude and can be switched off by setting `MOTION.parallaxX/Y` to 0 in `config.ts`.

INTEGRATION NOTES:
- The parent must give `HeroArtwork` a size. `HomePage.tsx` already wraps it in an `aspect-square` box, which
  suits the composition.
- The box has `pointer-events: none`, so it may overlap the headline column without blocking links.
- `shadow-float` grounding is drawn inside the artwork (ground shadow); do not add a CSS box shadow around it.
- If a content-security policy is added, the scene needs `canvas`/WebGL only: no `blob:`, worker or remote
  origins.

STATUS: READY FOR REVIEW
