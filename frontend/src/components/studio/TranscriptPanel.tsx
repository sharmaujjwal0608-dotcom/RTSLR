"use client";

import { useState } from "react";
import { Button, Notice, Select, Slider } from "@/components/ui";
import { useMessages } from "@/i18n";
import {
  copyText,
  exportSessionAsJson,
  exportSessionAsText,
  formatMessage,
  languageMessages,
  useSpeech,
  type OutputLanguage,
  type UseTranscriptResult,
} from "@/features/language";

export function TranscriptPanel({ transcript }: { transcript: UseTranscriptResult }) {
  const m = useMessages(languageMessages);
  const speech = useSpeech();
  const [toast, setToast] = useState<string | null>(null);
  const lang = transcript.outputLanguage;

  const speak = () => {
    const r = speech.speak(transcript.text, lang);
    if (!r.ok) {
      if (r.reason === "network_consent_required") return; // warning shown below
      setToast(r.reason === "empty" ? m.speechNothingToSpeak : r.reason === "unsupported" ? m.speechUnsupported : m.speechFailed);
    }
  };

  const exportAs = (kind: "txt" | "json") => {
    const session = transcript.currentSession();
    if (!session) return setToast(m.exportEmpty);
    const r = kind === "txt" ? exportSessionAsText(session, { language: lang }) : exportSessionAsJson(session, { language: lang });
    setToast(r.ok ? formatMessage(m.exportSuccess, { filename: r.filename }) : m.exportFailed);
  };

  return (
    <div className="flex flex-col gap-4">
      <Notice tone="info" compact title={m.notTranslationTitle}>
        {m.notTranslationShort}
      </Notice>

      <Select
        label={m.outputLanguageLabel}
        hint={m.outputLanguageHelp}
        value={lang}
        onChange={(e) => transcript.setOutputLanguage(e.target.value as OutputLanguage)}
        options={[
          { value: "en", label: m.outputEnglish },
          { value: "hi", label: m.outputHindi },
        ]}
      />

      <label className="flex flex-col gap-1">
        <span className="text-small font-semibold text-ink">{m.transcriptLabel}</span>
        <textarea
          {...transcript.textareaProps}
          rows={5}
          placeholder={m.transcriptPlaceholder}
          className="min-h-32 w-full rounded-field border border-line-strong bg-surface p-3 text-lead text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </label>
      <p className="text-caption text-muted">
        {formatMessage(m.characterCount, { count: transcript.characterCount })} · {formatMessage(m.wordCount, { count: transcript.wordCount })}
      </p>
      {transcript.showsMissingHindi && <Notice tone="warning" compact>{m.noHindiMappingDetail}</Notice>}
      {transcript.showsUnreviewedHindi && <Notice tone="info" compact>{m.hindiNotReviewedDetail}</Notice>}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={transcript.insertSpace}>{m.insertSpace}</Button>
        <Button variant="secondary" size="sm" onClick={transcript.insertNewLine}>{m.insertNewLine}</Button>
        <Button variant="secondary" size="sm" onClick={transcript.backspace}>{m.backspace}</Button>
        <Button variant="secondary" size="sm" onClick={transcript.undo} disabled={!transcript.canUndo}>{m.undo}</Button>
        <Button variant="ghost" size="sm" onClick={transcript.clear} disabled={transcript.isEmpty}>{m.clear}</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={async () => {
            const r = await copyText(transcript.text);
            setToast(r.ok ? m.copySuccess : r.reason === "empty" ? m.copyEmpty : r.reason === "unsupported" ? m.copyUnsupported : m.copyFailed);
          }}
        >
          {m.copy}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => exportAs("txt")}>{m.exportText}</Button>
        <Button variant="secondary" size="sm" onClick={() => exportAs("json")}>{m.exportJson}</Button>
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-3">
        <div className="flex flex-wrap gap-2">
          {speech.state === "speaking" ? (
            <Button variant="secondary" size="sm" onClick={speech.pause}>{m.pause}</Button>
          ) : speech.state === "paused" ? (
            <Button variant="secondary" size="sm" onClick={speech.resume}>{m.resume}</Button>
          ) : (
            <Button variant="primary" size="sm" onClick={speak} disabled={!speech.supported || transcript.isEmpty}>{m.speak}</Button>
          )}
          <Button variant="ghost" size="sm" onClick={speech.stop} disabled={speech.state === "idle" || speech.state === "unsupported"}>{m.stop}</Button>
        </div>
        {speech.ready && !speech.supported && <p className="text-caption text-muted">{m.speechUnsupported}</p>}
        {speech.supported && speech.networkVoice[lang] && !speech.networkVoiceAccepted && (
          <Notice
            tone="warning"
            compact
            title={m.networkVoiceTitle}
            actions={
              <Button variant="secondary" size="sm" onClick={speech.acceptNetworkVoice}>{m.networkVoiceAccept}</Button>
            }
          >
            {formatMessage(m.networkVoiceWarning, { language: lang === "hi" ? m.outputHindi : m.outputEnglish })}
          </Notice>
        )}
        <Slider label={m.speechRate} min={0.5} max={1.5} step={0.1} value={speech.rate} onValueChange={speech.setRate} formatValue={(v) => `${v.toFixed(1)}×`} />
        <p className="text-caption text-muted">{m.speechReadsLabels}</p>
      </div>

      {toast && (
        <p role="status" className="text-small text-ink">
          {toast}
        </p>
      )}
    </div>
  );
}
