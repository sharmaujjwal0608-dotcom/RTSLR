"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Card, Kbd } from "@/components/ui";
import { defineMessages, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import {
  FINGERTIP_INDICES,
  HAND_BONES,
  HAND_POINTS,
  HAND_VIEWBOX,
  LANDMARK_IDS,
  fingerOf,
  type FingerKey,
} from "./handGeometry";

const messages = defineMessages({
  en: {
    groupLabel: "Hand landmarks. Use the arrow keys to move between the 21 points.",
    pointLabel: (index: number, name: string) => `Landmark ${index}: ${name}`,
    index: "Index",
    name: "Name",
    part: "Part of the hand",
    slots: "Position in the 63-D vector",
    slotsValue: (from: number, to: number) => `values ${from}–${to} (x, y, z)`,
    fingertip: "Fingertip: used in the 5 × 5 two-hand fingertip distances",
    reference: "Reference point: every other landmark is measured from the wrist",
    palmScale: "With the wrist, sets the palm length that scales the hand",
    hint: "Point at a joint, tap it, or focus the diagram and use",
    caption: "Schematic open hand. It shows landmark positions only and does not depict a sign.",
    finger: {
      wrist: "Wrist",
      thumb: "Thumb",
      index: "Index finger",
      middle: "Middle finger",
      ring: "Ring finger",
      little: "Little finger",
    } satisfies Record<FingerKey, string>,
    joint: ["Wrist", "Base joint", "Knuckle", "Middle joint", "Tip"],
    jointFinger: ["Knuckle", "Middle joint", "Upper joint", "Tip"],
  },
  hi: {
    groupLabel: "हाथ के लैंडमार्क। 21 बिंदुओं के बीच जाने के लिए तीर कुंजियों का उपयोग करें।",
    pointLabel: (index: number, name: string) => `लैंडमार्क ${index}: ${name}`,
    index: "क्रमांक",
    name: "नाम",
    part: "हाथ का भाग",
    slots: "63-D वेक्टर में स्थान",
    slotsValue: (from: number, to: number) => `मान ${from}–${to} (x, y, z)`,
    fingertip: "उँगली का सिरा: दो हाथों के बीच 5 × 5 सिरों की दूरियों में उपयोग होता है",
    reference: "संदर्भ बिंदु: बाकी हर लैंडमार्क कलाई से नापा जाता है",
    palmScale: "कलाई के साथ मिलकर हथेली की वह लंबाई तय करता है जिससे हाथ का माप सामान्य होता है",
    hint: "किसी जोड़ पर पॉइंटर ले जाएँ, उसे छुएँ, या चित्र पर फ़ोकस करके दबाएँ",
    caption: "खुले हाथ का रेखाचित्र। यह केवल लैंडमार्क की जगह दिखाता है, कोई संकेत नहीं।",
    finger: {
      wrist: "कलाई",
      thumb: "अँगूठा",
      index: "तर्जनी",
      middle: "मध्यमा",
      ring: "अनामिका",
      little: "कनिष्ठा",
    } satisfies Record<FingerKey, string>,
    joint: ["कलाई", "आधार जोड़", "पोर", "बीच का जोड़", "सिरा"],
    jointFinger: ["पोर", "बीच का जोड़", "ऊपरी जोड़", "सिरा"],
  },
});

const COUNT = HAND_POINTS.length;

/**
 * Explorable 21-landmark hand diagram. Hover, tap or focus a joint to read
 * its index, published name and where it lands in the single-hand feature
 * vector. One tab stop; arrow keys, Home and End move the selection.
 */
export function HandLandmarkExplorer({ className }: { className?: string }) {
  const t = useMessages(messages);
  const [selected, setSelected] = useState(8);
  const groupRef = useRef<SVGGElement>(null);
  const readoutId = useId();

  const finger = fingerOf(selected);
  const jointName =
    finger === "wrist"
      ? t.joint[0]
      : finger === "thumb"
        ? t.joint[selected]
        : t.jointFinger[(selected - 5) % 4];
  const readable = finger === "wrist" ? t.finger.wrist : `${t.finger[finger]}, ${jointName.toLowerCase()}`;
  const note =
    selected === 0
      ? t.reference
      : selected === 9
        ? t.palmScale
        : FINGERTIP_INDICES.includes(selected)
          ? t.fingertip
          : null;

  function move(next: number) {
    const index = (next + COUNT) % COUNT;
    setSelected(index);
    groupRef.current?.querySelector<SVGGElement>(`[data-index="${index}"]`)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<SVGGElement>) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        move(selected + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        move(selected - 1);
        break;
      case "Home":
        event.preventDefault();
        move(0);
        break;
      case "End":
        event.preventDefault();
        move(COUNT - 1);
        break;
      default:
    }
  }

  return (
    <Card padding="none" className={cn("overflow-hidden", className)}>
      <div className="grid sm:grid-cols-2">
        <div className="bg-background-secondary p-4">
          <svg
            viewBox={`-10 0 ${HAND_VIEWBOX.width + 20} ${HAND_VIEWBOX.height + 5}`}
            className="mx-auto block aspect-[220/255] w-full max-w-80"
          >
            <g className="stroke-surface" strokeWidth={26} strokeLinecap="round" fill="none">
              {HAND_BONES.map(([a, b]) => (
                <line
                  key={`${a}-${b}`}
                  x1={HAND_POINTS[a].x}
                  y1={HAND_POINTS[a].y}
                  x2={HAND_POINTS[b].x}
                  y2={HAND_POINTS[b].y}
                />
              ))}
            </g>
            <g className="stroke-line-strong" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
              {HAND_BONES.map(([a, b]) => (
                <line
                  key={`${a}-${b}`}
                  x1={HAND_POINTS[a].x}
                  y1={HAND_POINTS[a].y}
                  x2={HAND_POINTS[b].x}
                  y2={HAND_POINTS[b].y}
                />
              ))}
            </g>
            <g ref={groupRef} role="radiogroup" aria-label={t.groupLabel} onKeyDown={onKeyDown}>
              {HAND_POINTS.map((point, index) => {
                const active = index === selected;
                return (
                  <g
                    key={index}
                    role="radio"
                    aria-checked={active}
                    aria-label={t.pointLabel(index, LANDMARK_IDS[index])}
                    aria-describedby={active ? readoutId : undefined}
                    tabIndex={active ? 0 : -1}
                    data-index={index}
                    onPointerEnter={() => setSelected(index)}
                    onClick={() => setSelected(index)}
                    onFocus={() => setSelected(index)}
                    className="cursor-pointer outline-none [&:focus-visible>.halo]:stroke-ink"
                  >
                    {/* Generous invisible hit area. */}
                    <circle cx={point.x} cy={point.y} r={11} fill="transparent" />
                    <circle
                      className={cn("halo fill-none", active ? "stroke-accent" : "stroke-transparent")}
                      cx={point.x}
                      cy={point.y}
                      r={10}
                      strokeWidth={2.5}
                    />
                    <circle
                      className={cn("stroke-ink", active ? "fill-ink" : "fill-surface")}
                      cx={point.x}
                      cy={point.y}
                      r={active ? 5.5 : 4.5}
                      strokeWidth={1.75}
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="flex flex-col justify-between gap-6 p-6">
          <div id={readoutId}>
          <dl className="flex flex-col">
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <dt className="text-caption text-muted">{t.index}</dt>
              <dd className="font-mono text-h2 text-ink">{selected}</dd>
            </div>
            <div className="flex flex-col gap-1 border-b border-line py-3">
              <dt className="text-caption text-muted">{t.name}</dt>
              <dd className="font-mono text-small font-medium break-all text-ink">{LANDMARK_IDS[selected]}</dd>
            </div>
            <div className="flex flex-col gap-1 border-b border-line py-3">
              <dt className="text-caption text-muted">{t.part}</dt>
              <dd className="text-small font-semibold text-ink">{readable}</dd>
            </div>
            <div className="flex flex-col gap-1 py-3">
              <dt className="text-caption text-muted">{t.slots}</dt>
              <dd className="font-mono text-small text-ink">{t.slotsValue(selected * 3, selected * 3 + 2)}</dd>
            </div>
            {/* Fixed-height slot so the card does not jump between joints. */}
          </dl>
            <p className="min-h-16 text-caption text-accent-ink">{note}</p>
          </div>
          <p className="text-caption text-muted">
            {t.hint} <Kbd>←</Kbd> <Kbd>→</Kbd>
          </p>
        </div>
      </div>
      <p className="border-t border-line px-6 py-3 text-caption text-muted">{t.caption}</p>
    </Card>
  );
}
