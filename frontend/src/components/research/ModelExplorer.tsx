"use client";

import { Badge } from "@/components/ui";
import { MODEL_RECORDS, type ModelInputId, type ModelKindId, type ModelRecord } from "@/content/research/system";
import { defineMessages, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { commonMessages } from "./sections";
import { DocSection, Fact, Mono } from "./parts";

const messages = defineMessages({
  en: {
    intro:
      "Every model carries a kind, and the interface labels come from it. Three things can run today; the fourth slot, a validated ISL model, is empty and stays visible so that nothing else is mistaken for it.",
    kinds: {
      legacy_asl_prototype: "Legacy ASL prototype",
      experimental_isl_user_trained: "Experimental ISL, trained from your own samples",
      simulator: "Simulator",
      validated_isl: "Validated ISL model — none yet",
    } satisfies Record<ModelKindId, string>,
    available: "Runs today",
    missing: "Does not exist",
    kind: "Kind",
    modelId: "Model id",
    version: "Version",
    signLanguage: "Sign language",
    input: "Input type",
    scoreType: "Score type",
    validated: "Validated",
    notValidated: "No",
    module: "Module",
    none: "None",
    noVersion: "None: there is no model file",
    inputs: {
      single_hand_static: "One hand, static pose (63-D vector)",
      single_or_dual_static: "One hand (63-D) or two hands together (156-D), static pose",
      synthetic_frames: "None: it produces synthetic hand frames in place of the camera",
    } satisfies Record<ModelInputId, string>,
    classifierScore: "Classifier score, not a probability",
    simulatorScore: "None of its own: the selected model scores the synthetic frames",
    noScore: "Not applicable: there is no model",
    requires: "What a validated ISL model requires",
    listLabel: "Model kinds",
  },
  hi: {
    intro:
      "हर मॉडल का एक प्रकार होता है और इंटरफ़ेस के लेबल उसी से आते हैं। आज तीन चीज़ें चल सकती हैं; चौथा स्थान — सत्यापित ISL मॉडल — ख़ाली है और दिखता रहता है, ताकि किसी और चीज़ को वह न समझ लिया जाए।",
    kinds: {
      legacy_asl_prototype: "पुराना ASL प्रोटोटाइप",
      experimental_isl_user_trained: "प्रायोगिक ISL, आपके अपने नमूनों से प्रशिक्षित",
      simulator: "सिम्युलेटर",
      validated_isl: "सत्यापित ISL मॉडल — अभी कोई नहीं",
    } satisfies Record<ModelKindId, string>,
    available: "आज चलता है",
    missing: "मौजूद नहीं है",
    kind: "प्रकार",
    modelId: "मॉडल आईडी",
    version: "संस्करण",
    signLanguage: "सांकेतिक भाषा",
    input: "इनपुट का प्रकार",
    scoreType: "स्कोर का प्रकार",
    validated: "सत्यापित",
    notValidated: "नहीं",
    module: "मॉड्यूल",
    none: "कोई नहीं",
    noVersion: "कोई नहीं: मॉडल फ़ाइल मौजूद नहीं है",
    inputs: {
      single_hand_static: "एक हाथ, स्थिर मुद्रा (63-D वेक्टर)",
      single_or_dual_static: "एक हाथ (63-D) या दोनों हाथ एक साथ (156-D), स्थिर मुद्रा",
      synthetic_frames: "कोई नहीं: यह कैमरे की जगह कृत्रिम हाथ-फ़्रेम बनाता है",
    } satisfies Record<ModelInputId, string>,
    classifierScore: "क्लासिफ़ायर स्कोर, प्रायिकता नहीं",
    simulatorScore: "अपना कोई नहीं: चुना हुआ मॉडल कृत्रिम फ़्रेमों को स्कोर देता है",
    noScore: "लागू नहीं: कोई मॉडल नहीं है",
    requires: "सत्यापित ISL मॉडल के लिए क्या चाहिए",
    listLabel: "मॉडल के प्रकार",
  },
});

function ModelEntry({ model }: { model: ModelRecord }) {
  const t = useMessages(messages);
  const common = useMessages(commonMessages);
  const headingId = `model-${model.kind}`;

  const score =
    model.scoreType === "classifier_score"
      ? t.classifierScore
      : model.kind === "simulator"
        ? t.simulatorScore
        : t.noScore;

  return (
    <li>
      <article
        aria-labelledby={headingId}
        className={cn(
          "rounded-card p-6",
          model.exists ? "border border-line bg-surface" : "border-2 border-dashed border-line-strong bg-background",
        )}
      >
        <header className="flex flex-wrap items-start justify-between gap-3">
          <h3 id={headingId} className="min-w-0 text-h3 break-words text-ink">
            {t.kinds[model.kind]}
          </h3>
          <div className="flex flex-wrap gap-2">
            <Badge tone={model.exists ? "neutral" : "warning"}>{model.exists ? t.available : t.missing}</Badge>
            {model.signLanguage ? <Badge plain>{model.signLanguage}</Badge> : null}
          </div>
        </header>

        <p lang="en" className="mt-3 max-w-reading text-body text-ink">
          {model.description}
        </p>

        <dl className="mt-6 grid gap-x-8 gap-y-5 border-t border-line pt-5 sm:grid-cols-2">
          <Fact label={t.kind}>
            <Mono>{model.kind}</Mono>
          </Fact>
          <Fact label={t.modelId}>{model.id ? <Mono>{model.id}</Mono> : t.none}</Fact>
          <Fact label={t.version}>
            {model.version ? <Mono>{model.version}</Mono> : model.exists ? t.none : t.noVersion}
          </Fact>
          <Fact label={t.signLanguage}>{model.signLanguage ?? t.none}</Fact>
          <Fact label={t.input}>{model.input && model.exists ? t.inputs[model.input] : t.noScore}</Fact>
          <Fact label={t.scoreType}>{score}</Fact>
          <Fact label={t.validated}>
            <Badge tone="warning">{t.notValidated}</Badge>
          </Fact>
          <Fact label={t.module}>
            <Mono>{model.module}</Mono>
          </Fact>
        </dl>

        {model.requires.length > 0 ? (
          <div className="mt-6 border-t border-line pt-5">
            <h4 className="text-h4 text-ink">{t.requires}</h4>
            <ul lang="en" className="mt-3 flex max-w-reading list-disc flex-col gap-2 pl-5 text-small text-ink">
              {model.requires.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 border-t border-line pt-5">
          <h4 className="text-h4 text-ink">{common.limitations}</h4>
          <ul lang="en" className="mt-3 flex max-w-reading list-disc flex-col gap-2 pl-5 text-small text-ink">
            {model.limitations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </article>
    </li>
  );
}

export function ModelExplorer() {
  const t = useMessages(messages);
  return (
    <DocSection id="models" intro={<p>{t.intro}</p>}>
      <ul aria-label={t.listLabel} className="flex max-w-narrow flex-col gap-6">
        {MODEL_RECORDS.map((model) => (
          <ModelEntry key={model.kind} model={model} />
        ))}
      </ul>
    </DocSection>
  );
}
