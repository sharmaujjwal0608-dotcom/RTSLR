# AGENT 07 Report (second pass: R&D pages)

## AGENT

Agent 07 - Research and Development Director

## ASSIGNED TASK

Build the R&D section of the website (`/research`) from the research records produced in the first pass.

## OWNED FILES

- `frontend/src/app/research/**`
- `frontend/src/components/research/**`
- `frontend/src/content/research/**`
- `frontend/scripts/sync-research-data.mjs`
- `research/**`, `docs/RESEARCH_NOTES.md` (corrections only)
- `docs/agent-reports/AGENT_07_PAGES.md`

## DEPENDENCIES

- `@/components/ui` primitives and the tokens in `globals.css` (Agent 02).
- `@/i18n` (`defineMessages`, `useMessages`, `useI18n`, `I18nProvider`).
- `frontend/src/features/recognition/registry.ts` (Agent 06): read, and imported in one test only.
- `frontend/src/types/recognition.ts`: feature dimensions and schema, imported in one test only.
- `research/data/*.json`.

## IMPLEMENTED FEATURES

One page, `/research`: a server component that exports `metadata`, validates the records and passes them to client components. Sticky contents list from `lg` with the current section marked; a sticky labelled jump menu below `lg`.

1. Research overview: goal, sourced statements with links into the reference list, and the 15 assumptions as a table.
2. Architecture explorer: seven pipeline stages as a keyboard-operable tab list (arrow keys, Home, End, roving tabindex) joined by inline SVG arrows; the panel shows inputs, outputs, module path and known limitations.
3. Model explorer: legacy ASL prototype, experimental user-trained ISL, simulator, and a dashed empty slot "Validated ISL model — none yet" with what it requires. Shows kind, id, version, input type, score type and validated flag. All four entries are always visible; nothing is hidden behind a control.
4. Feature specification: the three normalisation steps, the 63-D and 156-D layouts as tables, a to-scale strip of the 156 values, and why two hand labels are not two-hand recognition.
5. Dataset explorer: search plus three labelled selects, a live result count (`role="status"`), a "Clear filters" button that appears only when a filter is set, and an empty result message. Licence text is shown exactly as recorded; "Used by RTSLR" is read from the data (No for all 13).
6. Experiments: a designed empty state ("No experiments have been run yet"), then the eight planned specifications, each badged "Plan, not run" or "Outline only, not run". Real records render with dataset version, signers, samples, protocol, feature version, seed, commit, a metrics table and an artefacts link; runs with fewer than 5 signers are badged as pilot.
7. Published benchmarks: an 11-column table in file order (not ranked, no chart) with a prominent notice that the figures are other groups' results, not comparable and not RTSLR measurements. A column states how each entry appeared in the legacy prototype and what verification found. The two unsourced legacy numbers are not rendered.
8. References: 20 entries with verified/unverified badge and verification note; each is an anchor target for the ids used elsewhere on the page.
9. Roadmap: phases on a single vertical rule, with status badges and dependency links.

English and Hindi for all headings, labels and page copy. Research record text stays in English, is marked `lang="en"`, and a notice says so in Hindi mode.

Tables are real `<table>`s with `<caption>`, `scope="col"` and `scope="row"`, inside a labelled, focusable `overflow-x-auto` region.

## FILES CREATED OR MODIFIED

Created:

- `frontend/scripts/sync-research-data.mjs`
- `frontend/src/app/research/page.tsx`
- `frontend/src/components/research/`: `sections.ts`, `parts.tsx`, `ResearchHeader.tsx`, `ResearchContents.tsx`, `Overview.tsx`, `ArchitectureExplorer.tsx`, `ModelExplorer.tsx`, `FeatureSpec.tsx`, `DatasetExplorer.tsx`, `Experiments.tsx`, `PublishedBenchmarks.tsx`, `References.tsx`, `Roadmap.tsx`, `Experiments.test.tsx`, `explorers.test.tsx`
- `frontend/src/content/research/`: `types.ts`, `guards.ts`, `index.ts`, `datasetFilter.ts`, `system.ts`, `notes.ts`, `guards.test.ts`, `datasetFilter.test.ts`, `system.test.ts`, `data/*.json` (five generated copies)
- `docs/agent-reports/AGENT_07_PAGES.md`

Modified (research record corrections):

- `research/data/datasets.json`: added a `verificationNote` to all 13 records, written from what the first pass already recorded. No other field changed.
- `research/data/roadmap.json`: `rm-05` changed from `planned` to `in_progress` and its description rewritten, because a feature extractor for `rtslr-features-1` already exists in `frontend/src/features/tracking/features.ts`.
- `docs/RESEARCH_NOTES.md` section 4: added a correction that the application implements the 156-value `rtslr-features-1` contract, not the 158-value `dualhand-v1` proposal, and how the two differ.
- `research/experiments/EXPERIMENT_SPECS.md`: added the record schema for `rtslr-experiments.json` and a note on the feature vector.

## TESTS RUN

- `npx vitest run src/content/research src/components/research`
- `npx tsc --noEmit -p .`
- `npx eslint src/app/research src/components/research src/content/research scripts/sync-research-data.mjs`
- `node scripts/sync-research-data.mjs` and `node scripts/sync-research-data.mjs --check`

## TEST RESULTS

- Vitest: 5 test files passed, 55 tests passed.
- `tsc`: no errors in files under `research` or `scripts/`.
- ESLint: exit code 0, no output.
- Sync: five files copied (13, 16, 20, 12 and 0 records); `--check` reported the copies up to date.
- Not run: `next build`, `next dev`, Playwright. The page has not been viewed in a browser.

## KNOWN LIMITATIONS

- The page was never rendered in a browser. Layout, the sticky contents, the mobile jump menu, Hindi wrapping at 320px and reduced-motion behaviour are unchecked.
- `system.ts` (pipeline stages, model records, feature layouts) and `notes.ts` (established facts, assumptions, experiment plans, legacy audit) are transcribed by hand from the Markdown documents and from Agent 06's `ModelInfo`. `system.test.ts` compares the model records and feature dimensions with the live code; the Markdown transcriptions have no such check.
- The model mirror already drifted once during this pass (Agent 06 changed a limitation string) and was resynchronised. It will fail again on the next change, by design.
- The model explorer is a static list, not an interactive control.
- The sign-language filter currently offers one value, because all 13 datasets are ISL.
- The published benchmarks table is about 112rem wide and scrolls sideways at every viewport width.
- Module paths are shown as text, not links: no repository URL is defined.
- Hindi copy was written by this agent and has not been reviewed by a Hindi speaker.

## INTEGRATION NOTES

- **Wire the data sync into the build.** In `frontend/package.json` add `"prebuild": "node scripts/sync-research-data.mjs"` (and optionally the same in `predev`), and `node scripts/sync-research-data.mjs --check` in CI. The copies under `src/content/research/data/` should be committed so a frontend-only checkout still builds.
- The site header needs a link to `/research`.
- Malformed research JSON fails the build: `loadResearchData()` throws `ResearchDataError` naming the file, record and field.
- `rtslr-experiments.json` records must follow the schema now documented in `EXPERIMENT_SPECS.md`.
- `system.test.ts` imports `listModels` from the recognition registry. If that import becomes unsafe in jsdom, move the test rather than deleting the comparison.
- ML agents: `RESEARCH_NOTES.md` and `EXPERIMENT_SPECS.md` still describe `dualhand-v1` (158 values) as the experiment feature; the correction notes say the application implements `rtslr-features-1` (156 values).

## STATUS

TESTED (unit tests, type check and lint only; not viewed in a browser)
