# RTSLR master plan

Owner: Agent 00. Status of each item lives in `DEVELOPMENT_STATUS.md`; who owns what is in `AGENT_ASSIGNMENTS.md`.

## Goal

A premium multi-page ISL platform: marketing site, working camera recognition studio, ISL learning area,
R&D area, small API, and a real ML training pipeline — with every capability labelled for what it truly is.

## Waves

| Wave | Agents | Output | Gate to next wave |
|---|---|---|---|
| 1 Foundation | 00, 02, 07, 12 | Scaffold, shared contracts, design system, research records, security requirements | Contracts written; design primitives compile |
| 2 Build | 01, 03, 04, 05, 06, 08, 09, 10, 07 (R&D pages) | Pages, hero artwork, tracking, models, language layer, API, database, learning | Each module type-checks and its unit tests pass |
| 3 Integrate | 01 (studio assembly), 11, 13, 14, 15 | Studio wired end to end, accessibility fixes, automated tests, CI and deployment files | Production build succeeds; test suites pass |
| 4 Release review | 00, 12 (implementation audit) | Browser verification, acceptance checklist, final report | Critical failures fixed or reported |

Backend, tracking, models and language agents do not depend on the design system and start as soon as
the contracts exist. Page agents wait for the design system.

## Priorities

1. Architecture and frontend foundation
2. Recognition studio (camera, tracking, model adapter, transcript)
3. Product, Use Cases, About, Learn ISL, R&D pages
4. ML pipeline and research records connected to the R&D pages
5. Accessibility, security, performance, tests, deployment

## Non-negotiables

- No fabricated agent work, test results, models, accuracy or latency figures.
- ASL classification is never presented as ISL recognition.
- No dead links or decorative controls.
- Camera only on user action; no frame leaves the browser.
