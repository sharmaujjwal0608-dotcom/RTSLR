# AGENT 07 Report

## AGENT

Agent 07 - Research and Development Director

## ASSIGNED TASK

Build the research foundation for RTSLR: verify the legacy prototype's citations, survey ISL datasets and published ISL/ASL landmark results, write research notes and experiment specifications, and produce machine-readable data for the R&D web pages. Research content only; no application code.

## OWNED FILES

- `docs/RESEARCH_NOTES.md`
- `docs/agent-reports/AGENT_07.md`
- `research/reports/dataset-evaluation.md`
- `research/experiments/EXPERIMENT_SPECS.md`
- `research/data/references.json`
- `research/data/datasets.json`
- `research/data/published-benchmarks.json`
- `research/data/roadmap.json`
- `research/data/rtslr-experiments.json`

## DEPENDENCIES

- Read-only input: `C:\Users\OIZOM\Desktop\paytm\basic version.html` (legacy ASL prototype, R&D tab and chart).
- Public web sources (listed in `references.json`).
- No dependency on other agents' files. Nothing under `frontend/` was read or modified.

## IMPLEMENTED FEATURES

- Source audit: 20 references recorded, each opened where possible, with a per-reference verification note. 19 verified, 1 unverified.
- Legacy prototype audit: all four reference links checked against their sources; all seven chart bars traced (see RESEARCH_NOTES.md section 10).
- Dataset evaluation: 13 candidate ISL datasets recorded with licence wording as stated on the source page. 6 verified, 7 unverified.
- 16 published benchmark entries, each tied to a reference, with evaluation protocol and a caveat.
- Research notes covering ISL vs ASL, static vs dynamic signs, landmark normalisation, a proposed 158-value dual-hand feature vector (`dualhand-v1`), sequence model options, signer-independent evaluation rules, browser constraints and 15 explicit unverified assumptions.
- Five experiment specifications (EXP-001 to EXP-005) plus three outlined follow-ups. Plans only.
- 12-item roadmap.
- `rtslr-experiments.json` is exactly `[]`.

## FILES CREATED OR MODIFIED

Created (all new; nothing existing was modified):

- `RTSLR/docs/RESEARCH_NOTES.md`
- `RTSLR/docs/agent-reports/AGENT_07.md`
- `RTSLR/research/reports/dataset-evaluation.md`
- `RTSLR/research/experiments/EXPERIMENT_SPECS.md`
- `RTSLR/research/data/references.json`
- `RTSLR/research/data/datasets.json`
- `RTSLR/research/data/published-benchmarks.json`
- `RTSLR/research/data/roadmap.json`
- `RTSLR/research/data/rtslr-experiments.json`

## TESTS RUN

1. `node -e "JSON.parse(require('fs').readFileSync(p))"` on each of the five JSON files.
2. Cross-reference script: every `referenceId` in `published-benchmarks.json` exists in `references.json`; every `metricValue` is a number; every roadmap `dependsOn` ID exists; no duplicate IDs; every `ref-...` ID used in the Markdown files exists in `references.json`; no dataset has `usedByRtslr: true`.
3. Byte check that `rtslr-experiments.json` contains exactly `[]`.

## TEST RESULTS

- All five JSON files parse. Array lengths: references 20, datasets 13, published-benchmarks 16, roadmap 12, rtslr-experiments 0.
- Cross-reference checks: no missing reference IDs, no non-numeric metric values, no broken roadmap dependencies, no duplicate IDs, no undefined reference IDs in Markdown.
- `rtslr-experiments.json` content is `[]` (2 bytes).
- No machine-learning experiment was run. There are no RTSLR accuracy, latency or frame-rate results.

## KNOWN LIMITATIONS

- `data.mendeley.com` could not be opened from this environment (TLS certificate error), so ISL-CSLTR and four static ISL image datasets are unverified and their licences unconfirmed.
- The ISLRTC dictionary website (connection refused) and the data.gov.in catalogue (HTTP 403) could not be opened; the dictionary's size and reuse terms are unconfirmed.
- Kaggle dataset pages did not render for automated reading; no Kaggle ISL dataset is verified.
- The MDPI article page returned HTTP 403; that reference was verified from the PubMed Central copy of the same article.
- Several references were verified at abstract level only (noted per reference): Sundar 2022, Shenoy 2018, OpenHands, MediaPipe Hands paper, Pal 2023, CISLR, ISL-FS results. The INCLUDE paper itself was not opened; facts come from its Zenodo record.
- INCLUDE's signer count (7) and CISLR's video and signer counts come from other papers' comparison tables, not from the datasets' own pages.
- No verified, freely downloadable, multi-signer static ISL alphabet dataset was found.
- The per-letter list of one-handed, two-handed and motion-dependent ISL letters was not confirmed from an authoritative source; it needs a fluent ISL signer.
- The `dualhand-v1` feature vector is a proposal with no experimental support yet.
- No dataset files were downloaded or inspected, as instructed.

## INTEGRATION NOTES

- R&D pages should load the JSON files from `research/data/`. Field names follow the task specification.
- `references.json`: `authors` is an array of strings; `year` is a number or `null` (documentation and web pages without a publication year).
- `published-benchmarks.json`: `metricValue` is a number in the unit named in `metricName`. `classes` is a number or `null`. Metrics are mixed (accuracy, mAP, detection rate, character error rate, relative decrease), so do not plot them on one axis or rank them. Show `dataset`, `evaluationProtocol` and `caveat` next to every value. A table is recommended instead of the legacy bar chart.
- Show a "verified / unverified" badge from the `verified` flag and expose `verificationNote`.
- Do not carry over the legacy chart bars "MediaPipe + ML (ASL) 96.5" and "2-Hand ISL + CNN 92.0": no source was found. The "MediaPipe + LSTM (ASL) 99.0" bar had no citation; a probable source is recorded as `ref-sundar-2022-mediapipe-lstm-asl`.
- Do not carry over the legacy "30+ FPS" statement; no measurement exists.
- `rtslr-experiments.json` is `[]`. The UI should render an explicit empty state ("No RTSLR experiments have been run yet") and must never fall back to published numbers.
- `roadmap.json`: only `rm-01` is `done`; everything else is `planned`.
- For the ML agents: the feature definition is in RESEARCH_NOTES.md section 4, the sample record schema and split rules are in EXPERIMENT_SPECS.md. Two documented MediaPipe facts affect implementation: x and y are normalised by width and height separately (correct for aspect ratio), and world landmarks are centred per hand (inter-hand relations must use image-space landmarks).
- Before any public dataset is used, its licence must be re-read on the source page; iSign and ISL-FS are non-commercial.

## STATUS

READY FOR REVIEW
