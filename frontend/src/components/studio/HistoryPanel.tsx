"use client";

import { Button, Notice, Switch } from "@/components/ui";
import { useMessages } from "@/i18n";
import { formatMessage, languageMessages, type UseTranscriptResult } from "@/features/language";
import { studioMessages } from "./messages";

export function HistoryPanel({ transcript }: { transcript: UseTranscriptResult }) {
  const t = useMessages(studioMessages);
  const m = useMessages(languageMessages);
  const err = transcript.historyStorageError;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-muted">{m.finishSessionHelp}</p>
      <Button variant="primary" size="sm" disabled={transcript.isEmpty} onClick={() => transcript.finishSession()}>
        {m.finishSession}
      </Button>
      <Switch label={m.keepHistory} hint={m.keepHistoryHelp} checked={transcript.keepHistory} onChange={(e) => transcript.setKeepHistory(e.target.checked)} />
      {err && (
        <Notice tone="warning" compact>
          {err === "quota" ? m.historyQuota : err === "invalid" ? m.historyInvalid : m.historyUnavailable}
        </Notice>
      )}
      {!transcript.keepHistory && <p className="text-caption text-muted">{m.historyMemoryNote}</p>}
      <p className="text-small font-semibold text-ink">{m.historyTitle}</p>
      {transcript.history.length === 0 ? (
        <p className="text-small text-muted">{m.historyEmpty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {transcript.history.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 py-2 text-small">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">{formatMessage(m.sessionLabel, { date: new Date(s.endedAt).toLocaleString() })}</span>
                <Button variant="ghost" size="sm" onClick={() => transcript.deleteSession(s.id)}>{m.deleteSession}</Button>
              </div>
              <p className="truncate text-muted" lang={s.outputLanguage}>
                {s.text[s.outputLanguage] || m.sessionTypedOnly}
              </p>
              <p className="text-caption text-muted">
                {s.tokens.length} {t.tokensN}
              </p>
            </li>
          ))}
        </ul>
      )}
      {transcript.history.length > 0 && (
        <Button variant="ghost" size="sm" onClick={transcript.deleteAllSessions}>{m.deleteAllSessions}</Button>
      )}
    </div>
  );
}
