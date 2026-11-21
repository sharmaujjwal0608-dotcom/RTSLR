"use client";

import { Pause, Play } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { defineMessages, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { FINGERTIP_INDICES, HAND_POINTS, HAND_VIEWBOX, HandGlyph } from "@/components/marketing/handGeometry";

const messages = defineMessages({
  en: {
    stagesLabel: "Recognition pipeline, in order",
    play: "Play the sequence",
    pause: "Pause",
    caption:
      "Illustration of the processing steps. It is a drawing, not a recognition result, and the hand shown is not a sign.",
    stages: [
      {
        title: "Camera",
        text: "You start the camera with a click. Each frame is read inside the browser tab and then discarded; none is uploaded or saved.",
      },
      {
        title: "Hand landmarks",
        text: "A hand-tracking model finds up to two hands and places 21 points on each: the wrist and every finger joint.",
      },
      {
        title: "Coordinated two-hand features",
        text: "Each hand becomes 63 numbers. When two hands are present they are joined into one 156-number description that also records how the hands sit relative to each other.",
      },
      {
        title: "Model",
        text: "The selected model scores that description against the signs it knows, or says it is uncertain. Which model is running is always labelled.",
      },
      {
        title: "Stabilised transcript",
        text: "A single frame never types anything. Recent frames must agree and the pose must be held before one entry is added to the transcript.",
      },
    ],
  },
  hi: {
    stagesLabel: "पहचान की प्रक्रिया, क्रम से",
    play: "क्रम चलाएँ",
    pause: "रोकें",
    caption:
      "प्रोसेसिंग के चरणों का रेखाचित्र। यह एक चित्र है, पहचान का नतीजा नहीं, और दिखाया गया हाथ कोई संकेत नहीं है।",
    stages: [
      {
        title: "कैमरा",
        text: "कैमरा आपके क्लिक से शुरू होता है। हर फ़्रेम ब्राउज़र टैब के भीतर पढ़ा जाता है और फिर छोड़ दिया जाता है; कोई फ़्रेम अपलोड या सहेजा नहीं जाता।",
      },
      {
        title: "हाथ के लैंडमार्क",
        text: "हाथ पहचानने वाला मॉडल अधिकतम दो हाथ ढूँढता है और हर हाथ पर 21 बिंदु रखता है: कलाई और उँगलियों का हर जोड़।",
      },
      {
        title: "दोनों हाथों के समन्वित फ़ीचर",
        text: "हर हाथ 63 संख्याओं में बदलता है। दो हाथ होने पर उन्हें 156 संख्याओं के एक विवरण में जोड़ा जाता है, जिसमें यह भी दर्ज होता है कि दोनों हाथ एक-दूसरे के सापेक्ष कहाँ हैं।",
      },
      {
        title: "मॉडल",
        text: "चुना गया मॉडल इस विवरण की तुलना उन संकेतों से करता है जिन्हें वह जानता है, या बताता है कि वह अनिश्चित है। कौन-सा मॉडल चल रहा है, यह हमेशा लिखा रहता है।",
      },
      {
        title: "स्थिर की गई ट्रांसक्रिप्ट",
        text: "अकेला एक फ़्रेम कभी कुछ नहीं लिखता। हाल के फ़्रेम सहमत होने चाहिए और मुद्रा कुछ देर टिकनी चाहिए, तभी ट्रांसक्रिप्ट में एक प्रविष्टि जुड़ती है।",
      },
    ],
  },
});

const STAGE_COUNT = 5;
const STEP_MS = 2400;

/* ---------------------------------------------------------------- scenes */

const FRAME = (
  <>
    <rect x={20} y={16} width={280} height={208} rx={18} className="fill-background-secondary stroke-line-strong" strokeWidth={1.5} />
    <g className="stroke-ink" strokeWidth={2.5} strokeLinecap="round" fill="none">
      <path d="M36 52V40a8 8 0 0 1 8-8h12" />
      <path d="M264 32h12a8 8 0 0 1 8 8v12" />
      <path d="M284 188v12a8 8 0 0 1-8 8h-12" />
      <path d="M56 208H44a8 8 0 0 1-8-8v-12" />
    </g>
  </>
);

const HAND_IN_FRAME = "translate(84 26) scale(0.76)";

function tip(index: number, offsetX: number, mirrored: boolean, scale: number, offsetY: number) {
  const point = HAND_POINTS[index];
  const x = mirrored ? HAND_VIEWBOX.width - point.x : point.x;
  return { x: offsetX + x * scale, y: offsetY + point.y * scale };
}

const PAIR_SCALE = 0.56;
const PAIR_Y = 48;
const PAIR_A_X = 30;
const PAIR_B_X = 178;

const VECTOR_BARS = [34, 52, 22, 44, 60, 28, 48, 18, 40, 56, 30, 46];

function Scene({ stage }: { stage: number }) {
  switch (stage) {
    case 0:
      return (
        <>
          {FRAME}
          <HandGlyph transform={HAND_IN_FRAME} />
          <circle cx={52} cy={48} r={5} className="fill-accent" />
        </>
      );
    case 1:
      return (
        <>
          {FRAME}
          <HandGlyph transform={HAND_IN_FRAME} bones dots />
        </>
      );
    case 2: {
      const wristA = tip(0, PAIR_A_X, false, PAIR_SCALE, PAIR_Y);
      const wristB = tip(0, PAIR_B_X, true, PAIR_SCALE, PAIR_Y);
      return (
        <>
          <HandGlyph transform={`translate(${PAIR_A_X} ${PAIR_Y}) scale(${PAIR_SCALE})`} bones dots />
          <HandGlyph transform={`translate(${PAIR_B_X} ${PAIR_Y}) scale(${PAIR_SCALE})`} bones dots mirrored />
          <g className="stroke-accent" strokeWidth={1.5} strokeDasharray="3 4" strokeLinecap="round">
            {FINGERTIP_INDICES.map((index) => {
              const a = tip(index, PAIR_A_X, false, PAIR_SCALE, PAIR_Y);
              const b = tip(index, PAIR_B_X, true, PAIR_SCALE, PAIR_Y);
              return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
            })}
          </g>
          <line
            x1={wristA.x}
            y1={wristA.y}
            x2={wristB.x}
            y2={wristB.y}
            className="stroke-ink"
            strokeWidth={2}
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
          <text x={wristA.x} y={212} textAnchor="middle" className="fill-muted font-mono text-label">
            A
          </text>
          <text x={wristB.x} y={212} textAnchor="middle" className="fill-muted font-mono text-label">
            B
          </text>
        </>
      );
    }
    case 3:
      return (
        <>
          <g className="fill-line-strong">
            {VECTOR_BARS.map((width, index) => (
              <rect key={index} x={24} y={36 + index * 14} width={width} height={6} rx={3} />
            ))}
          </g>
          <path d="M96 120h22m-7-7 7 7-7 7" className="stroke-ink" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <rect x={130} y={70} width={84} height={100} rx={16} className="fill-surface stroke-ink" strokeWidth={2} />
          <g className="stroke-line-strong" strokeWidth={1.5}>
            <path d="M152 96 192 108M152 96 192 132M152 120 192 108M152 120 192 132M152 144 192 108M152 144 192 132" />
          </g>
          <g className="fill-ink">
            <circle cx={152} cy={96} r={5} />
            <circle cx={152} cy={120} r={5} />
            <circle cx={152} cy={144} r={5} />
            <circle cx={192} cy={108} r={5} />
            <circle cx={192} cy={132} r={5} />
          </g>
          <path d="M224 120h22m-7-7 7 7-7 7" className="stroke-ink" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <g>
            <rect x={258} y={94} width={44} height={8} rx={4} className="fill-ink" />
            <rect x={258} y={116} width={22} height={8} rx={4} className="fill-line-strong" />
            <rect x={258} y={138} width={12} height={8} rx={4} className="fill-line-strong" />
          </g>
        </>
      );
    default:
      return (
        <>
          <g>
            {Array.from({ length: 8 }, (_, index) => (
              <rect
                key={index}
                x={36 + index * 32}
                y={36}
                width={24}
                height={10}
                rx={5}
                className={index < 6 ? "fill-ink" : "fill-surface stroke-line-strong"}
                strokeWidth={1.5}
              />
            ))}
          </g>
          <rect x={36} y={64} width={248} height={10} rx={5} className="fill-surface stroke-line-strong" strokeWidth={1.5} />
          <rect x={36} y={64} width={248} height={10} rx={5} className="fill-accent" />
          <path d="M160 86v20m-7-7 7 7 7-7" className="stroke-ink" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <rect x={36} y={118} width={248} height={90} rx={16} className="fill-surface stroke-ink" strokeWidth={2} />
          <g className="fill-line">
            <rect x={54} y={138} width={150} height={10} rx={5} />
            <rect x={54} y={158} width={196} height={10} rx={5} />
            <rect x={54} y={178} width={64} height={10} rx={5} />
          </g>
          <rect x={126} y={174} width={3} height={18} rx={1.5} className="fill-ink" />
        </>
      );
  }
}

/* ------------------------------------------------------------- component */

/**
 * The real pipeline (camera → hand landmarks → coordinated two-hand features
 * → model → stabilised transcript) as a five-stage illustration. It plays
 * once when scrolled into view, can be paused, and every stage can be picked
 * directly. All five explanations are always readable; with reduced motion
 * nothing moves on its own.
 */
export function PipelineDemo() {
  const t = useMessages(messages);
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.4 });

  const [active, setActive] = useState(0);
  /* null = the visitor has not chosen yet: play once when it scrolls into view. */
  const [choice, setChoice] = useState<boolean | null>(null);
  const playing = choice ?? (inView && !reduce);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (active >= STAGE_COUNT - 1) setChoice(false);
      else setActive(active + 1);
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, active]);

  function toggle() {
    if (playing) {
      setChoice(false);
      return;
    }
    if (active >= STAGE_COUNT - 1) setActive(0);
    setChoice(true);
  }

  return (
    <div ref={rootRef} className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-6">
        <div className="lg:sticky lg:top-[calc(var(--header-height)+2rem)]">
          <figure className="overflow-hidden rounded-panel border border-line bg-surface">
            <svg viewBox="0 0 320 240" aria-hidden="true" className="block aspect-[4/3] w-full">
              <AnimatePresence mode="wait" initial={false}>
                <motion.g
                  key={active}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.28, ease: [0.22, 0.61, 0.36, 1] }}
                >
                  <Scene stage={active} />
                </motion.g>
              </AnimatePresence>
            </svg>
            <figcaption className="border-t border-line px-6 py-4 text-caption text-muted">{t.caption}</figcaption>
          </figure>
          <div className="mt-5">
            <Button variant="secondary" leadingIcon={playing ? <Pause /> : <Play />} onClick={toggle}>
              {playing ? t.pause : t.play}
            </Button>
          </div>
        </div>
      </div>

      <ol aria-label={t.stagesLabel} className="flex flex-col lg:col-span-6">
        {t.stages.map((stage, index) => {
          const current = index === active;
          return (
            <li key={index} className="border-t border-line last:border-b">
              <button
                type="button"
                aria-current={current ? "step" : undefined}
                onClick={() => {
                  setChoice(false);
                  setActive(index);
                }}
                className="group/stage flex w-full gap-5 py-5 text-left"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-label font-medium transition-colors duration-200 ease-calm",
                    current
                      ? "border-ink bg-ink text-on-ink"
                      : "border-line-strong text-ink group-hover/stage:border-ink",
                  )}
                >
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-h4 text-ink">{stage.title}</span>
                  <span className="text-small text-muted">{stage.text}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
