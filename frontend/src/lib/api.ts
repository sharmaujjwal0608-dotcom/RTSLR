/**
 * Browser → RTSLR API helper (docs/API_CONTRACTS.md, v1).
 *
 * The site works without the backend; only feedback needs it. Nothing here
 * ever carries camera frames or landmarks. Requests send no cookies and no
 * referrer.
 *
 * Owner: Agent 01.
 */

/** Base URL without a trailing slash, or "" when the API is not configured. */
export const API_BASE_URL: string = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

export const isApiConfigured: boolean = API_BASE_URL.length > 0;

/** Version of the consent text shown beside the feedback form. The server must accept it. */
export const FEEDBACK_CONSENT_VERSION = "1";

export const FEEDBACK_MESSAGE_MAX = 2000;

export const FEEDBACK_KINDS = ["general", "recognition_issue", "content_issue"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** `FeedbackIn` without the consent fields, which `submitFeedback` adds. */
export type FeedbackInput = {
  kind: FeedbackKind;
  message: string;
  modelId?: string;
  classId?: string;
  locale?: "en" | "hi";
};

/** `FeedbackOut`. The deletion token is returned once and stored hashed on the server. */
export type FeedbackReceipt = { id: string; deletionToken: string };

export type ApiErrorKind =
  /** NEXT_PUBLIC_API_BASE_URL is not set. */
  | "not_configured"
  /** The request never got an answer (offline, DNS, CORS, server down). */
  | "network"
  /** No answer within the time limit. */
  | "timeout"
  /** The server answered with an error status. */
  | "http"
  /** The server answered 2xx with a body that does not match the contract. */
  | "invalid_response";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** `error.code` from the API error envelope, when present. */
  readonly code?: string;

  constructor(kind: ApiErrorKind, message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status;
    this.code = options.code;
  }
}

const TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function request(path: string, init: RequestInit): Promise<Response> {
  if (!isApiConfigured) {
    throw new ApiError("not_configured", "The RTSLR API address is not configured.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      ...init,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new ApiError("timeout", "The RTSLR API did not answer in time.");
    }
    throw new ApiError("network", cause instanceof Error ? cause.message : "The request could not be sent.");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let code: string | undefined;
    let message = `The RTSLR API answered ${response.status}.`;
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && isRecord(body.error)) {
        if (typeof body.error.code === "string") code = body.error.code;
        if (typeof body.error.message === "string") message = body.error.message;
      }
    } catch {
      /* not JSON: keep the generic message */
    }
    throw new ApiError("http", message, { status: response.status, code });
  }
  return response;
}

/**
 * POST /api/v1/feedback. Call only after the user has ticked the consent box:
 * this function states `consent: true` on their behalf.
 */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackReceipt> {
  const response = await request("/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consent: true,
      consentVersion: FEEDBACK_CONSENT_VERSION,
      kind: input.kind,
      message: input.message,
      ...(input.modelId ? { modelId: input.modelId } : {}),
      ...(input.classId ? { classId: input.classId } : {}),
      ...(input.locale ? { locale: input.locale } : {}),
    }),
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("invalid_response", "The RTSLR API sent a reply that is not JSON.");
  }
  if (!isRecord(body) || typeof body.id !== "string" || typeof body.deletionToken !== "string") {
    throw new ApiError("invalid_response", "The RTSLR API reply has no feedback id or deletion token.");
  }
  return { id: body.id, deletionToken: body.deletionToken };
}

/**
 * DELETE /api/v1/feedback/{id} with the deletion token. Resolves on 204.
 * A 404 means the id is unknown or the token is wrong (the API does not say which).
 */
export async function deleteFeedback(id: string, deletionToken: string): Promise<void> {
  await request(`/feedback/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "X-Deletion-Token": deletionToken },
  });
}
