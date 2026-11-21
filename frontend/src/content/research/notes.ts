/**
 * Research record text that lives in Markdown rather than JSON, transcribed
 * for the R&D page. English is the source language of these records.
 *
 * Sources; update this file when they change:
 *  - docs/RESEARCH_NOTES.md sections 1, 3, 7 (established), 9 (assumptions)
 *    and 10 (audit of the legacy prototype)
 *  - research/experiments/EXPERIMENT_SPECS.md (experiment plans)
 */

/* ------------------------------------------------------------------ */
/* What is established (sourced statements)                            */
/* ------------------------------------------------------------------ */

export type EstablishedFact = {
  statement: string;
  /** Ids in references.json. */
  referenceIds: string[];
};

export const ESTABLISHED_FACTS: EstablishedFact[] = [
  {
    statement:
      "ISL was developed by the Indian deaf community and is its own language, not a version of ASL.",
    referenceIds: ["ref-nios-isl-history"],
  },
  {
    statement:
      "ISL fingerspelling is two-handed and similar to British Sign Language fingerspelling. The legacy prototype's one-handed ASL rules therefore cannot be re-labelled as ISL.",
    referenceIds: ["ref-nios-isl-history", "ref-wikipedia-ipsl"],
  },
  {
    statement:
      "Meaning in ISL is not only in the hands: mouth patterns, facial expression, body posture, head position, eye gaze and the use of space are part of the language. A hands-only pipeline cannot cover it.",
    referenceIds: ["ref-wikipedia-ipsl"],
  },
  {
    statement:
      "MediaPipe Hand Landmarker gives 21 landmarks per hand. x and y are normalised by image width and height separately, and each hand's world coordinates are centred on that hand, so the relation between two hands must be computed from image-space landmarks after an aspect-ratio correction.",
    referenceIds: ["ref-mediapipe-hand-landmarker-docs", "ref-mediapipe-hand-landmarker-web"],
  },
  {
    statement:
      "Of the published results audited, only one uses a signer-independent split, and it is for word-level signs, not the alphabet. The high alphabet accuracies come from random splits.",
    referenceIds: ["ref-patra-2024-hwgat-fdmse", "ref-kulkarni-2026-isl-rf", "ref-kumar-2023-mediapipe-cnn-asl"],
  },
  {
    statement:
      "ISL fingerspelling is under-resourced: the one continuous-fingerspelling baseline found has a very high character error rate.",
    referenceIds: ["ref-kirandevraj-2025-isl-fingerspelling"],
  },
  {
    statement:
      "No verified, freely downloadable, multi-signer dataset of static ISL letters and digits was found. RTSLR uses none of the datasets listed on this page.",
    referenceIds: [],
  },
];

/* ------------------------------------------------------------------ */
/* Assumptions (RESEARCH_NOTES.md section 9)                           */
/* ------------------------------------------------------------------ */

export type Assumption = {
  id: string;
  assumption: string;
  whyUnverified: string;
  howToResolve: string;
};

export const ASSUMPTIONS: Assumption[] = [
  {
    id: "A1",
    assumption: "Most ISL letters are two-handed, with a small number one-handed",
    whyUnverified: "Sources confirm fingerspelling is two-handed and BSL-like; none read gave a per-letter list",
    howToResolve: "Build the inventory with a fluent signer and the ISLRTC dictionary (rm-03)",
  },
  {
    id: "A2",
    assumption: "Which ISL letters need motion",
    whyUnverified: "One paper says H and J; no authoritative per-letter source read",
    howToResolve: "Same as A1",
  },
  {
    id: "A3",
    assumption: "MediaPipe detects both hands reliably enough when they touch or overlap",
    whyUnverified: "Only evidence is one paper's per-letter detection rates on a private dataset",
    howToResolve: "EXP-001",
  },
  {
    id: "A4",
    assumption: "The inter-hand feature block improves recognition",
    whyUnverified: "No source measures it for ISL",
    howToResolve: "EXP-004",
  },
  {
    id: "A5",
    assumption: "Wrist-centred, palm-length scaling is the best normalisation",
    whyUnverified: "Carried over from the ASL prototype; no comparison found",
    howToResolve: "EXP-004",
  },
  {
    id: "A6",
    assumption: "Mirroring makes left- and right-dominant signing equivalent",
    whyUnverified: "Reasonable but untested; individual signs could differ",
    howToResolve: "EXP-004 and signer review",
  },
  {
    id: "A7",
    assumption: "k-NN or a small MLP is sufficient for static ISL signs",
    whyUnverified: "Published high accuracies come from random splits",
    howToResolve: "EXP-002, EXP-003",
  },
  {
    id: "A8",
    assumption: "Real-time frame rate is achievable in the browser on mid-range phones",
    whyUnverified: "No browser latency source; prototype's 30+ FPS is unmeasured",
    howToResolve: "EXP-005",
  },
  {
    id: "A9",
    assumption: "A Web Worker would remove main-thread blocking",
    whyUnverified: "Not tested; not stated in the documentation read",
    howToResolve: "EXP-005",
  },
  {
    id: "A10",
    assumption: "INCLUDE has 7 signers",
    whyUnverified: "From two papers' comparison tables, not from the dataset's own page",
    howToResolve: "Read the INCLUDE paper",
  },
  {
    id: "A11",
    assumption: "The ISLRTC dictionary has about 10,000 terms",
    whyUnverified: "News reports only; the dictionary site could not be opened",
    howToResolve: "Re-check the dictionary site (rm-02)",
  },
  {
    id: "A12",
    assumption: "Fingerspelling in ISL is used mainly for names and terms without a sign",
    whyUnverified: "General background (search extract only)",
    howToResolve: "Ask fluent signers; affects product scope",
  },
  {
    id: "A13",
    assumption: "Regional variation does not change the alphabet and digits",
    whyUnverified: "Not checked",
    howToResolve: "Ask fluent signers from more than one region",
  },
  {
    id: "A14",
    assumption: "The legacy table's \"ISL hard pairs: C, M, N, H, Z\" generalises",
    whyUnverified: "It is one paper's result on one private dataset",
    howToResolve: "Replace with RTSLR's own confusion matrix once measured",
  },
  {
    id: "A15",
    assumption: "The legacy table's \"ISL features: 126-D / Holistic\"",
    whyUnverified: "126-D matches one paper; nothing read supports \"Holistic\" as a requirement for the alphabet",
    howToResolve: "Decide after EXP-004",
  },
];

/* ------------------------------------------------------------------ */
/* Planned experiments (EXPERIMENT_SPECS.md). Plans, not results.      */
/* ------------------------------------------------------------------ */

export type ExperimentPlan = {
  id: string;
  title: string;
  question: string;
  /** What will be measured or compared. */
  measures: string[];
  /** Roadmap item that schedules it, if any. */
  roadmapId: string | null;
  /** True for the "later experiments" that are only outlined in the spec. */
  outlineOnly: boolean;
};

export const EXPERIMENT_PLANS: ExperimentPlan[] = [
  {
    id: "EXP-001",
    title: "Two-hand detection feasibility",
    question:
      "For each ISL letter and digit, how often does MediaPipe Hand Landmarker return the number of hands the sign needs?",
    measures: [
      "Per sign: share of frames with the expected number of hands, with fewer, and with more",
      "Handedness label stability during a hold",
      "Landmark jitter during a hold",
      "The same with detection and presence thresholds at 0.3 and 0.7",
    ],
    roadmapId: "rm-06",
    outlineOnly: false,
  },
  {
    id: "EXP-002",
    title: "Static classifier baselines with dual-hand features",
    question:
      "How well do k-NN and a small MLP classify static ISL letters and digits from the dual-hand feature vector on signers never seen in training?",
    measures: [
      "Top-1 accuracy and macro-F1 on held-out signers (mean, spread, worst signer)",
      "Per-class precision, recall and F1, a confusion matrix and the top confused pairs",
      "Coverage: share of frames with a prediction; accuracy on covered frames and over all frames",
      "Results split into one-handed and two-handed signs",
    ],
    roadmapId: "rm-07",
    outlineOnly: false,
  },
  {
    id: "EXP-003",
    title: "Signer-dependent versus signer-independent gap",
    question: "How much does a random split overstate accuracy on this data?",
    measures: [
      "The same model under a random frame-level 80/20 split, a random split by recording, and a signer-independent split",
      "Optionally a fourth arm that augments before a random split, to quantify that leakage",
      "A learning curve: held-out-signer accuracy as the number of training signers grows",
    ],
    roadmapId: "rm-07",
    outlineOnly: false,
  },
  {
    id: "EXP-004",
    title: "Feature ablation",
    question: "Which parts of the feature design matter? In particular, does the inter-hand block help?",
    measures: [
      "Held-out-signer accuracy and macro-F1 for eight feature variants on the same folds and seeds",
      "Fold-wise paired differences, stating plainly when a difference is within fold-to-fold variation",
      "A breakdown for two-handed signs",
      "Second-pass addition: include the implemented rtslr-features-1 (156-D) layout as a variant next to the 158-value dualhand-v1 proposal",
    ],
    roadmapId: "rm-07",
    outlineOnly: false,
  },
  {
    id: "EXP-005",
    title: "Browser performance",
    question: "What frame rate and latency does the full pipeline reach in real browsers?",
    measures: [
      "Detection time per frame (median and 95th percentile)",
      "Feature extraction and classifier time per frame",
      "Delivered frames per second, dropped frames and main-thread long tasks",
      "GPU delegate versus CPU; model load time and download size",
      "A sustained run of several minutes, on at least one laptop, one mid-range Android phone and one iPhone",
    ],
    roadmapId: "rm-08",
    outlineOnly: false,
  },
  {
    id: "EXP-006",
    title: "Temporal smoothing",
    question:
      "How do window length, hold-to-confirm time and abstention threshold trade letter-level error against delay in live use?",
    measures: [],
    roadmapId: null,
    outlineOnly: true,
  },
  {
    id: "EXP-007",
    title: "Dynamic baseline",
    question:
      "How does a landmark-sequence model perform on INCLUDE-50 using its official split, after confirming whether that split is signer-independent?",
    measures: [],
    roadmapId: "rm-09",
    outlineOnly: true,
  },
  {
    id: "EXP-008",
    title: "External test",
    question:
      "How does the static model perform on a public static ISL set, if one with a suitable licence is obtained?",
    measures: [],
    roadmapId: null,
    outlineOnly: true,
  },
];

/** Prerequisites common to every planned experiment (EXPERIMENT_SPECS.md). */
export const EXPERIMENT_PREREQUISITES: string[] = [
  "A sign inventory reviewed by a fluent ISL signer (rm-03)",
  "Landmark data collected with consent, with signer ids (rm-04)",
  "The tested feature extractor (rm-05)",
];

/* ------------------------------------------------------------------ */
/* Audit of the legacy prototype (RESEARCH_NOTES.md section 10)        */
/* ------------------------------------------------------------------ */

export type LegacyAuditEntry = {
  /** How the figure appeared in the legacy prototype. */
  appearedAs: string;
  finding: string;
};

/** Keyed by the id of the matching entry in published-benchmarks.json. */
export const LEGACY_AUDIT: Record<string, LegacyAuditEntry> = {
  "pb-kumar-2023-asl-alphabet": {
    appearedAs: "Chart bar \"MediaPipe + CNN (ASL)\" and a reference link",
    finding:
      "Matches the abstract. The paper is internally inconsistent (its results section says 100%), uses a random 80/20 split and is a preprint.",
  },
  "pb-owo-ai-xgboost-asl": {
    appearedAs: "Chart bar \"Owo AI XGBoost (ASL)\" and a reference link",
    finding:
      "Matches the README. Self-reported, no paper. The prototype's wording \"wrist-normalized\" was not confirmed.",
  },
  "pb-kulkarni-2026-isl-alphabet": {
    appearedAs: "Chart bar \"MediaPipe + RF (ISL)\" and a reference link",
    finding:
      "The figure matches the paper. The prototype did not mention that the split is applied after augmentation or that the signer count is not stated.",
  },
  "pb-kulkarni-2026-isl-detection-rate": {
    appearedAs: "Quoted in the text of the same reference link",
    finding: "Matches the paper. It is a detection rate, not a recognition accuracy.",
  },
  "pb-alsharif-2025-asl-map50": {
    appearedAs: "Chart bar \"YOLOv11 + MediaPipe (ASL)\" and a reference link",
    finding:
      "Matches the article (verified from the PubMed Central copy). It is mAP@0.5, a detection metric, which the prototype charted on the same axis as accuracy.",
  },
  "pb-sundar-2022-asl-lstm": {
    appearedAs: "Chart bar \"MediaPipe + LSTM (ASL)\" with no citation",
    finding:
      "The prototype gave no source. This paper is the probable source; that link is an inference, verified at abstract level only.",
  },
};

/** Problems with the legacy chart that are not tied to one entry. */
export const LEGACY_AUDIT_NOTES: string[] = [
  "Two further bars in the legacy chart had no source that could be found. They are not shown here.",
  "The legacy chart ranked results from different datasets, class counts and protocols on one axis, and mixed classification accuracy with detection mAP.",
  "Its heading said \"peer-reviewed and open-source\"; one source is a preprint and one is a GitHub README.",
  "The prototype's frame-rate statement had no measurement behind it and is not repeated.",
];
