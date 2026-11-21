"use client";

import { Copy, Send, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Button, Field, Notice, Select } from "@/components/ui";
import { defineMessages, useI18n, useMessages } from "@/i18n";
import {
  ApiError,
  FEEDBACK_KINDS,
  FEEDBACK_MESSAGE_MAX,
  deleteFeedback,
  isApiConfigured,
  submitFeedback,
  type FeedbackKind,
  type FeedbackReceipt,
} from "@/lib/api";

const messages = defineMessages({
  en: {
    unavailableTitle: "Feedback is not available on this deployment",
    unavailable:
      "This copy of RTSLR runs without its feedback service, so there is nowhere to send a message from here. Nothing you type on this site is stored.",
    kind: "What is it about?",
    kinds: {
      general: "General feedback or a question",
      recognition_issue: "A recognition problem",
      content_issue: "A mistake in the content",
    } satisfies Record<FeedbackKind, string>,
    message: "Message",
    messageHint:
      "Plain text only. Please do not include names, contact details or health information: we cannot reply, and the form has no field for an address.",
    counter: (n: number) => `${n} / ${FEEDBACK_MESSAGE_MAX}`,
    consent:
      "I agree that RTSLR stores this message and the category above so the project can improve. No camera data, name, email address, IP address or browser details are stored with it.",
    consentHint: "You can delete the message later with the token shown after sending.",
    send: "Send feedback",
    sending: "Sending…",
    errMessage: "Write a message before sending.",
    errConsent: "Tick the box to agree before sending. Without it nothing is sent.",
    failTitle: "The message was not sent",
    failNetwork:
      "The feedback service could not be reached. Check your connection and try again; your message is still in the form.",
    failTimeout: "The feedback service did not answer in time. Try again; your message is still in the form.",
    failRate: "Too many messages were sent from this connection. Wait a few minutes and try again.",
    failRejected: "The feedback service did not accept the message. Shorten it or remove unusual characters and try again.",
    failServer: "The feedback service reported an error. Try again later; your message is still in the form.",
    sentTitle: "Feedback sent",
    sent: "Thank you. Keep the token below if you may want this message deleted later. It is shown only once and we store only a scrambled copy of it.",
    feedbackId: "Feedback id",
    token: "Deletion token",
    copy: "Copy token",
    copied: "Token copied",
    copyFailed: "Could not copy. Select the token and copy it by hand.",
    deleteNow: "Delete this message now",
    deleting: "Deleting…",
    deletedTitle: "Message deleted",
    deleted: "The message was removed from the feedback service.",
    deleteFailed: "The message could not be deleted just now. Keep the token and try again later.",
    another: "Send another message",
  },
  hi: {
    unavailableTitle: "इस डिप्लॉयमेंट पर फ़ीडबैक उपलब्ध नहीं है",
    unavailable:
      "RTSLR की यह प्रति फ़ीडबैक सेवा के बिना चल रही है, इसलिए यहाँ से संदेश भेजने की कोई जगह नहीं है। इस साइट पर आप जो लिखते हैं, वह कहीं सहेजा नहीं जाता।",
    kind: "यह किस बारे में है?",
    kinds: {
      general: "सामान्य फ़ीडबैक या सवाल",
      recognition_issue: "पहचान से जुड़ी समस्या",
      content_issue: "सामग्री में गलती",
    } satisfies Record<FeedbackKind, string>,
    message: "संदेश",
    messageHint:
      "केवल सादा पाठ। कृपया नाम, संपर्क विवरण या स्वास्थ्य संबंधी जानकारी न लिखें: हम जवाब नहीं दे सकते, और फ़ॉर्म में पते के लिए कोई खाना नहीं है।",
    counter: (n: number) => `${n} / ${FEEDBACK_MESSAGE_MAX}`,
    consent:
      "मैं सहमत हूँ कि RTSLR इस संदेश और ऊपर चुनी गई श्रेणी को सहेजे, ताकि परियोजना बेहतर हो सके। इसके साथ कैमरा डेटा, नाम, ईमेल पता, IP पता या ब्राउज़र का विवरण नहीं सहेजा जाता।",
    consentHint: "भेजने के बाद दिखने वाले टोकन से आप संदेश बाद में मिटा सकते हैं।",
    send: "फ़ीडबैक भेजें",
    sending: "भेजा जा रहा है…",
    errMessage: "भेजने से पहले संदेश लिखें।",
    errConsent: "भेजने से पहले सहमति के खाने पर निशान लगाएँ। इसके बिना कुछ नहीं भेजा जाता।",
    failTitle: "संदेश नहीं भेजा गया",
    failNetwork:
      "फ़ीडबैक सेवा तक पहुँचा नहीं जा सका। अपना कनेक्शन जाँचकर दोबारा कोशिश करें; आपका संदेश फ़ॉर्म में ही है।",
    failTimeout: "फ़ीडबैक सेवा ने समय पर जवाब नहीं दिया। दोबारा कोशिश करें; आपका संदेश फ़ॉर्म में ही है।",
    failRate: "इस कनेक्शन से बहुत अधिक संदेश भेजे गए हैं। कुछ मिनट रुककर दोबारा कोशिश करें।",
    failRejected: "फ़ीडबैक सेवा ने संदेश स्वीकार नहीं किया। इसे छोटा करें या असामान्य वर्ण हटाकर दोबारा भेजें।",
    failServer: "फ़ीडबैक सेवा में त्रुटि आई। बाद में दोबारा कोशिश करें; आपका संदेश फ़ॉर्म में ही है।",
    sentTitle: "फ़ीडबैक भेज दिया गया",
    sent: "धन्यवाद। यदि आप बाद में यह संदेश मिटवाना चाहें तो नीचे दिया टोकन सँभालकर रखें। यह केवल एक बार दिखता है और हमारे पास इसकी केवल एक अपठनीय प्रति रहती है।",
    feedbackId: "फ़ीडबैक आईडी",
    token: "मिटाने का टोकन",
    copy: "टोकन कॉपी करें",
    copied: "टोकन कॉपी हो गया",
    copyFailed: "कॉपी नहीं हो सका। टोकन चुनकर हाथ से कॉपी करें।",
    deleteNow: "यह संदेश अभी मिटाएँ",
    deleting: "मिटाया जा रहा है…",
    deletedTitle: "संदेश मिटा दिया गया",
    deleted: "संदेश फ़ीडबैक सेवा से हटा दिया गया है।",
    deleteFailed: "संदेश अभी मिटाया नहीं जा सका। टोकन सँभालकर रखें और बाद में दोबारा कोशिश करें।",
    another: "एक और संदेश भेजें",
  },
});

type FailKey = "failNetwork" | "failTimeout" | "failRate" | "failRejected" | "failServer";

function failureKey(error: unknown): FailKey {
  if (!(error instanceof ApiError)) return "failServer";
  if (error.kind === "network" || error.kind === "not_configured") return "failNetwork";
  if (error.kind === "timeout") return "failTimeout";
  if (error.status === 429) return "failRate";
  if (error.status === 400 || error.status === 413 || error.status === 422) return "failRejected";
  return "failServer";
}

type Status =
  | { step: "editing"; failure?: FailKey }
  | { step: "sending" }
  | { step: "sent"; receipt: FeedbackReceipt; copy?: "ok" | "failed"; deletion?: "busy" | "failed" }
  | { step: "deleted" };

const textareaClass =
  "min-h-40 w-full resize-y rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-ink " +
  "transition-[border-color] duration-200 ease-calm placeholder:text-muted hover:border-ink focus-visible:border-ink " +
  "aria-invalid:border-danger-ink";

/**
 * Consent-managed feedback form (`FeedbackIn` in docs/API_CONTRACTS.md).
 * It sends a category and a plain-text message, nothing else, and only after
 * the consent box is ticked. When NEXT_PUBLIC_API_BASE_URL is not set it
 * renders a notice instead of a form that could not work.
 */
export function FeedbackForm({ className }: { className?: string }) {
  const t = useMessages(messages);
  const { locale } = useI18n();
  const id = useId();
  const messageId = `${id}-message`;
  const consentId = `${id}-consent`;

  const [kind, setKind] = useState<FeedbackKind>("general");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<Status>({ step: "editing" });

  if (!isApiConfigured) {
    return (
      <Notice tone="neutral" title={t.unavailableTitle} className={className}>
        {t.unavailable}
      </Notice>
    );
  }

  const trimmed = message.trim();
  const messageError = showErrors && trimmed.length === 0 ? t.errMessage : undefined;
  const consentError = showErrors && !consent ? t.errConsent : undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.step === "sending") return;
    if (trimmed.length === 0 || !consent) {
      setShowErrors(true);
      document.getElementById(trimmed.length === 0 ? messageId : consentId)?.focus();
      return;
    }
    setStatus({ step: "sending" });
    try {
      const receipt = await submitFeedback({ kind, message: trimmed, locale });
      setStatus({ step: "sent", receipt });
      setMessage("");
      setConsent(false);
      setShowErrors(false);
    } catch (error) {
      setStatus({ step: "editing", failure: failureKey(error) });
    }
  }

  async function copyToken(receipt: FeedbackReceipt) {
    let copy: "ok" | "failed" = "failed";
    try {
      await navigator.clipboard.writeText(receipt.deletionToken);
      copy = "ok";
    } catch {
      /* clipboard blocked: the token stays selectable on screen */
    }
    setStatus((current) => (current.step === "sent" ? { ...current, copy } : current));
  }

  async function removeNow(receipt: FeedbackReceipt) {
    setStatus({ step: "sent", receipt, deletion: "busy" });
    try {
      await deleteFeedback(receipt.id, receipt.deletionToken);
      setStatus({ step: "deleted" });
    } catch {
      setStatus({ step: "sent", receipt, deletion: "failed" });
    }
  }

  if (status.step === "deleted") {
    return (
      <Notice
        tone="success"
        live="polite"
        title={t.deletedTitle}
        className={className}
        actions={
          <Button variant="secondary" onClick={() => setStatus({ step: "editing" })}>
            {t.another}
          </Button>
        }
      >
        {t.deleted}
      </Notice>
    );
  }

  if (status.step === "sent") {
    const { receipt } = status;
    return (
      <div className={className}>
        <Notice
          tone="success"
          live="polite"
          title={t.sentTitle}
          actions={
            <>
              <Button leadingIcon={<Copy />} onClick={() => copyToken(receipt)}>
                {t.copy}
              </Button>
              <Button
                variant="secondary"
                leadingIcon={<Trash2 />}
                disabled={status.deletion === "busy"}
                onClick={() => removeNow(receipt)}
              >
                {status.deletion === "busy" ? t.deleting : t.deleteNow}
              </Button>
              <Button variant="ghost" onClick={() => setStatus({ step: "editing" })}>
                {t.another}
              </Button>
            </>
          }
        >
          <p>{t.sent}</p>
          <dl className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <dt className="text-caption font-semibold">{t.feedbackId}</dt>
              <dd className="font-mono text-small break-all select-all">{receipt.id}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-caption font-semibold">{t.token}</dt>
              <dd className="rounded-field bg-surface px-3 py-2 font-mono text-small break-all select-all">
                {receipt.deletionToken}
              </dd>
            </div>
          </dl>
          <p aria-live="polite" className="mt-3 min-h-5 text-caption font-semibold">
            {status.deletion === "failed"
              ? t.deleteFailed
              : status.copy === "ok"
                ? t.copied
                : status.copy === "failed"
                  ? t.copyFailed
                  : null}
          </p>
        </Notice>
      </div>
    );
  }

  const sending = status.step === "sending";
  const failure = status.step === "editing" ? status.failure : undefined;

  return (
    <form noValidate onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-7">
        <Select
          label={t.kind}
          value={kind}
          onChange={(event) => setKind(event.target.value as FeedbackKind)}
          options={FEEDBACK_KINDS.map((value) => ({ value, label: t.kinds[value] }))}
        />

        <Field
          label={t.message}
          htmlFor={messageId}
          hint={t.messageHint}
          error={messageError}
          labelAside={<span className="font-mono">{t.counter(message.length)}</span>}
        >
          <textarea
            id={messageId}
            name="message"
            rows={6}
            required
            maxLength={FEEDBACK_MESSAGE_MAX}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            aria-invalid={messageError ? true : undefined}
            aria-describedby={messageError ? `${messageId}-error` : `${messageId}-hint`}
            className={textareaClass}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <input
              id={consentId}
              type="checkbox"
              name="consent"
              required
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              aria-invalid={consentError ? true : undefined}
              aria-describedby={consentError ? `${consentId}-error ${consentId}-hint` : `${consentId}-hint`}
              className="mt-0.5 size-6 shrink-0 cursor-pointer rounded-md accent-ink"
            />
            <label htmlFor={consentId} className="cursor-pointer text-small text-ink">
              {t.consent}
            </label>
          </div>
          <p id={`${consentId}-hint`} className="pl-9 text-caption text-muted">
            {t.consentHint}
          </p>
          {consentError ? (
            <p id={`${consentId}-error`} className="pl-9 text-caption font-semibold text-danger-ink">
              {consentError}
            </p>
          ) : null}
        </div>

        {failure ? (
          <Notice tone="danger" live="assertive" title={t.failTitle}>
            {t[failure]}
          </Notice>
        ) : null}

        <div>
          <Button type="submit" size="lg" leadingIcon={<Send />} disabled={sending}>
            {sending ? t.sending : t.send}
          </Button>
        </div>
      </div>
    </form>
  );
}
