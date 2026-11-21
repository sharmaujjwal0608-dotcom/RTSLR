/**
 * Every `RecognitionResult.reason` string the bundled models can produce.
 *
 * They are plain English because `reason` is a string in the shared contract.
 * The interface layer can map these exact values to its own translated
 * messages (compare with `===`), and fall back to the English text otherwise.
 */
export const REASONS = {
  /* Legacy ASL prototype */
  legacyPrimaryHandOnly:
    "Two hands are visible. The ASL prototype reads one hand only, so it classified the primary hand and ignored the other.",
  legacyNoRuleMatch: "No ASL letter rule matched this hand shape strongly enough.",
  legacyBadLandmarks: "The tracked hand did not have 21 usable landmarks.",

  /* Experimental ISL model trained by the user */
  islNoSamples:
    "No signs have been recorded in this browser yet. Record samples of a sign before the experimental ISL model can recognise anything.",
  islNotLoaded: "The recorded samples have not been loaded yet.",
  islOnlyTwoHandClasses:
    "One hand is visible, but every sign recorded so far uses two hands. Show both hands or record a one-hand sign.",
  islOnlyOneHandClasses:
    "Two hands are visible, but every sign recorded so far uses one hand. Two-hand signs are matched as a whole and are never built from two one-hand results.",
  islTooFar: "This pose is not close enough to any sign you recorded.",
  islAmbiguous: "This pose sits between several signs you recorded.",
  islBadVector: "The feature vector for this frame was missing or malformed.",

  /* Exported (trained) model */
  exportedNeedsOneHand: "This model reads one hand. Two hands are visible.",
  exportedNeedsTwoHands: "This model reads a two-hand sign as a whole. Only one hand is visible.",
  exportedLowScore: "The model's best score is below its threshold.",
  exportedBadVector: "The feature vector for this frame was missing or malformed.",
} as const;

export type ReasonKey = keyof typeof REASONS;
