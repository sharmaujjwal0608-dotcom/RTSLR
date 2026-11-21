/**
 * Stable hand identity across frames.
 *
 * MediaPipe returns hands in an arbitrary order that can swap from one frame
 * to the next. This module assigns each detection to slot 0 or 1 by nearest
 * wrist distance to the slot's previous position, holds a slot through a few
 * frames of occlusion, and never swaps slots on 1 -> 2 or 2 -> 1 transitions.
 *
 * Pure: no DOM, no timers. Distances are measured in image heights after the
 * aspect correction of docs/MODEL_CONTRACTS.md section 1.
 */
import type { RawHandDetection } from "./types";

export type AssociationOptions = {
  /** Frames a slot is kept for an undetected hand before it is released. */
  maxMissedFrames: number;
  /** Largest wrist jump (image heights) still treated as the same hand.
   *  The limit grows by this amount for every missed frame. */
  maxMatchDistance: number;
  /** Two detections whose wrist and middle-finger base are both closer than
   *  this (image heights) are treated as one hand reported twice. */
  duplicateDistance: number;
};

export const DEFAULT_ASSOCIATION: AssociationOptions = {
  maxMissedFrames: 5,
  maxMatchDistance: 0.45,
  duplicateDistance: 0.04,
};

export type AssociatedHand = {
  slot: 0 | 1;
  detection: RawHandDetection;
  /** Frames in which this slot's current hand has been detected. Frames
   *  missed inside the occlusion tolerance do not reset it. */
  ageFrames: number;
  /** True on the first frame of a new identity in this slot. */
  isNew: boolean;
};

export type AssociationResult = {
  /** Detected hands this frame, ordered by slot. */
  hands: AssociatedHand[];
  /** Slots given to a new hand this frame: reset their filters and history. */
  resetSlots: (0 | 1)[];
  /** Slots whose hand was dropped this frame after the occlusion tolerance. */
  releasedSlots: (0 | 1)[];
};

type SlotState = {
  occupied: boolean;
  x: number;
  y: number;
  missed: number;
  age: number;
};

const SLOTS = [0, 1] as const;

function emptySlot(): SlotState {
  return { occupied: false, x: 0, y: 0, missed: 0, age: 0 };
}

export class HandAssociator {
  private readonly options: AssociationOptions;
  private slots: [SlotState, SlotState] = [emptySlot(), emptySlot()];

  constructor(options: Partial<AssociationOptions> = {}) {
    this.options = { ...DEFAULT_ASSOCIATION, ...options };
  }

  reset(): void {
    this.slots = [emptySlot(), emptySlot()];
  }

  /**
   * @param detections hands in detector order (any order, any count).
   * @param aspectRatio imageWidth / imageHeight of the frame.
   */
  update(detections: readonly RawHandDetection[], aspectRatio = 1): AssociationResult {
    const aspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
    const dets = this.dedupe(detections, aspect).slice(0, 2);
    const wrists = dets.map((d) => ({ x: d.landmarks[0].x * aspect, y: d.landmarks[0].y }));

    const occupied = SLOTS.filter((s) => this.slots[s].occupied);
    const cost = (det: number, slot: 0 | 1): number => {
      const st = this.slots[slot];
      const d = Math.hypot(wrists[det].x - st.x, wrists[det].y - st.y);
      const gate = this.options.maxMatchDistance * (1 + st.missed);
      return d <= gate ? d : Number.POSITIVE_INFINITY;
    };

    // Best one-to-one matching of detections to occupied slots: most matches
    // first, then smallest total wrist distance. At most 2 x 2, so enumerate.
    let best: { pairs: [number, 0 | 1][]; total: number } = { pairs: [], total: 0 };
    const consider = (pairs: [number, 0 | 1][]) => {
      let total = 0;
      for (const [d, s] of pairs) total += cost(d, s);
      if (!Number.isFinite(total)) return;
      if (pairs.length > best.pairs.length || (pairs.length === best.pairs.length && total < best.total)) {
        best = { pairs, total };
      }
    };
    for (let d = 0; d < dets.length; d++) {
      for (const s of occupied) {
        consider([[d, s]]);
        for (let d2 = d + 1; d2 < dets.length; d2++) {
          for (const s2 of occupied) {
            if (s2 !== s) consider([[d, s], [d2, s2]]);
          }
        }
      }
    }

    const slotOfDet = new Map<number, 0 | 1>(best.pairs);
    const matchedSlots = new Set<0 | 1>(best.pairs.map(([, s]) => s));
    const resetSlots: (0 | 1)[] = [];

    // Unmatched detections are new hands: take a free slot, or evict a slot
    // that is only being held for an occluded hand.
    for (let d = 0; d < dets.length; d++) {
      if (slotOfDet.has(d)) continue;
      const free =
        SLOTS.find((s) => !this.slots[s].occupied && !matchedSlots.has(s)) ??
        SLOTS.find((s) => !matchedSlots.has(s));
      if (free === undefined) continue;
      this.slots[free] = emptySlot();
      slotOfDet.set(d, free);
      matchedSlots.add(free);
      resetSlots.push(free);
    }

    const hands: AssociatedHand[] = [];
    for (const [d, slot] of slotOfDet) {
      const st = this.slots[slot];
      st.occupied = true;
      st.x = wrists[d].x;
      st.y = wrists[d].y;
      st.missed = 0;
      st.age += 1;
      hands.push({ slot, detection: dets[d], ageFrames: st.age, isNew: resetSlots.includes(slot) });
    }
    hands.sort((a, b) => a.slot - b.slot);

    const releasedSlots: (0 | 1)[] = [];
    for (const slot of SLOTS) {
      const st = this.slots[slot];
      if (!st.occupied || matchedSlots.has(slot)) continue;
      st.missed += 1;
      if (st.missed > this.options.maxMissedFrames) {
        this.slots[slot] = emptySlot();
        releasedSlots.push(slot);
      }
    }

    return { hands, resetSlots: resetSlots.sort(), releasedSlots };
  }

  private dedupe(detections: readonly RawHandDetection[], aspect: number): RawHandDetection[] {
    const limit = this.options.duplicateDistance;
    const kept: RawHandDetection[] = [];
    for (const det of detections) {
      if (det.landmarks.length < 21) continue;
      const duplicate = kept.some((k) =>
        [0, 9].every(
          (i) =>
            Math.hypot(
              (det.landmarks[i].x - k.landmarks[i].x) * aspect,
              det.landmarks[i].y - k.landmarks[i].y,
            ) < limit,
        ),
      );
      if (!duplicate) kept.push(det);
    }
    return kept;
  }
}
