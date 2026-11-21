"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { PIPELINE_STAGES, type PipelineStageId } from "@/content/research/system";
import { defineMessages, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { commonMessages } from "./sections";
import { DocSection, Mono } from "./parts";

const messages = defineMessages({
  en: {
    intro:
      "Everything camera-related runs in the browser, in this order. Select a stage to see what goes in, what comes out, where the code lives and what is known to be weak.",
    listLabel: "Pipeline stages, in order",
    keys: "Use the arrow keys to move between stages.",
    stageOf: (index: number, total: number) => `Stage ${index} of ${total}`,
    inputs: "Inputs",
    outputs: "Outputs",
    module: "Module in the repository",
    stages: {
      camera: "Camera",
      landmarker: "MediaPipe hand landmarker",
      tracking: "Smoothing and hand slots",
      features: "63-D and 156-D features",
      model: "Model",
      stabiliser: "Stabiliser",
      transcript: "Transcript",
    } satisfies Record<PipelineStageId, string>,
  },
  hi: {
    intro:
      "कैमरे से जुड़ा हर काम ब्राउज़र में, इसी क्रम में चलता है। कोई चरण चुनें और देखें कि उसमें क्या जाता है, क्या निकलता है, कोड कहाँ है और कौन-सी कमज़ोरियाँ ज्ञात हैं।",
    listLabel: "पाइपलाइन के चरण, क्रम से",
    keys: "चरणों के बीच जाने के लिए तीर कुंजियों का उपयोग करें।",
    stageOf: (index: number, total: number) => `चरण ${index} / ${total}`,
    inputs: "इनपुट",
    outputs: "आउटपुट",
    module: "रिपॉज़िटरी में मॉड्यूल",
    stages: {
      camera: "कैमरा",
      landmarker: "MediaPipe हैंड लैंडमार्कर",
      tracking: "स्मूदिंग और हाथों के स्लॉट",
      features: "63-D और 156-D फ़ीचर",
      model: "मॉडल",
      stabiliser: "स्टेबलाइज़र",
      transcript: "ट्रांसक्रिप्ट",
    } satisfies Record<PipelineStageId, string>,
  },
});

/** Connector between two stages: points right in the mobile row, down in the desktop column. */
function Connector() {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center md:h-5">
      <svg viewBox="0 0 24 12" className="h-3 w-6 text-line-strong md:rotate-90" fill="none" stroke="currentColor">
        <path d="M0 6h21" strokeWidth="1.5" />
        <path d="M16 1.5 21.5 6 16 10.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * The recognition pipeline as a selectable sequence (WAI-ARIA tabs with a
 * roving tabindex). Stages are HTML buttons joined by inline SVG arrows; the
 * panel shows the selected stage's inputs, outputs, module path and limits.
 */
export function ArchitectureExplorer() {
  const t = useMessages(messages);
  const common = useMessages(commonMessages);
  const baseId = useId();
  const [selected, setSelected] = useState<PipelineStageId>(PIPELINE_STAGES[0].id);
  const buttons = useRef<Map<PipelineStageId, HTMLButtonElement>>(new Map());

  const total = PIPELINE_STAGES.length;
  const selectedIndex = PIPELINE_STAGES.findIndex((stage) => stage.id === selected);
  const stage = PIPELINE_STAGES[selectedIndex];

  function select(index: number) {
    const next = PIPELINE_STAGES[(index + total) % total];
    setSelected(next.id);
    const button = buttons.current.get(next.id);
    button?.focus();
    // In the mobile row the newly selected stage may be off-screen.
    button?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        select(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        select(index - 1);
        break;
      case "Home":
        select(0);
        break;
      case "End":
        select(total - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  const tabId = (id: PipelineStageId) => `${baseId}-tab-${id}`;
  const panelId = `${baseId}-panel`;

  return (
    <DocSection id="architecture" intro={<p>{t.intro}</p>}>
      <div className="grid gap-6 md:grid-cols-12 md:gap-8">
        <div className="min-w-0 md:col-span-5">
          <div
            role="tablist"
            aria-label={t.listLabel}
            className="flex items-stretch gap-2 overflow-x-auto p-1 md:flex-col md:gap-0 md:overflow-visible"
          >
            {PIPELINE_STAGES.map((item, index) => {
              const isSelected = item.id === selected;
              return [
                index > 0 ? <Connector key={`${item.id}-connector`} /> : null,
                <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={tabId(item.id)}
                    aria-selected={isSelected}
                    aria-controls={panelId}
                    tabIndex={isSelected ? 0 : -1}
                    ref={(element) => {
                      if (element) buttons.current.set(item.id, element);
                      else buttons.current.delete(item.id);
                    }}
                    onClick={() => setSelected(item.id)}
                    onKeyDown={(event) => onKeyDown(event, index)}
                    className={cn(
                      "flex min-h-12 w-44 shrink-0 items-center gap-3 rounded-field border px-4 py-3 text-left text-small font-semibold transition-colors duration-200 ease-calm md:w-full",
                      isSelected
                        ? "border-ink bg-ink text-on-ink"
                        : "border-line-strong bg-surface text-ink hover:border-ink",
                    )}
                  >
                    <span aria-hidden="true" className="font-mono text-label opacity-70">
                      {index + 1}
                    </span>
                    <span className="min-w-0 break-words">{t.stages[item.id]}</span>
                </button>,
              ];
            })}
          </div>
          <p className="mt-3 hidden text-caption text-muted md:block">{t.keys}</p>
        </div>

        <div
          role="tabpanel"
          id={panelId}
          aria-labelledby={tabId(stage.id)}
          tabIndex={0}
          className="min-w-0 rounded-card border border-line bg-surface p-6 md:col-span-7"
        >
          <p className="font-mono text-label text-muted">{t.stageOf(selectedIndex + 1, total)}</p>
          <h3 className="mt-1 text-h3 break-words text-ink">{t.stages[stage.id]}</h3>

          <dl className="mt-6 flex flex-col gap-6">
            <div>
              <dt className="text-caption font-semibold text-muted">
                {t.inputs}
              </dt>
              <dd lang="en" className="mt-2">
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-small text-ink">
                  {stage.inputs.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt className="text-caption font-semibold text-muted">{t.outputs}</dt>
              <dd lang="en" className="mt-2">
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-small text-ink">
                  {stage.outputs.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt className="text-caption font-semibold text-muted">{t.module}</dt>
              <dd lang="en" className="mt-2 flex flex-col gap-1">
                {stage.modules.map((path) => (
                  <Mono key={path}>{path}</Mono>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-caption font-semibold text-muted">{common.limitations}</dt>
              <dd lang="en" className="mt-2">
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-small text-ink">
                  {stage.limitations.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </DocSection>
  );
}
