# RTSLR — Security and Privacy Requirements

Owner: Agent 12 (Security and Privacy Engineer). Pass 1: legacy audit and requirements. An implementation audit follows once the frontend and backend exist.

Scope of what was checked for this pass:

- `C:\Users\OIZOM\Desktop\paytm\basic version.html` — read in full (1320 lines).
- `RTSLR\frontend` scaffold — read only: `package.json` (Next.js 16.4.6, React 19.3.0), `next.config.ts` (`cacheComponents: true`), and the installed packages `@mediapipe/tasks-vision` 1.2.3 and `troika-three-text` 0.52.5.
- Next.js CSP guide: the copy bundled at `frontend/node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` and the online version (last updated 2026-03-20).
- `RTSLR\backend` did not exist yet. Everything in section 6 is a requirement, not an observation.

Requirement IDs (`CAM-01`, `BE-03`, ...) are written to be turned into tests. "MUST" means the implementation audit fails without it.

---

## 1. Audit of the legacy prototype

File: `basic version.html` ("SignBridge"). Single page, no build step, no server, no storage. Line numbers refer to that file.

### 1.1 Findings

| ID | Severity | Lines | Finding |
|----|----------|-------|---------|
| L-01 | High | 7 | Tailwind is loaded as an executable script from `cdn.tailwindcss.com/3.4.17` with no `integrity` and no `crossorigin`. This is the Play CDN: a compiler that runs in the page and injects styles at runtime. It has full access to the page, including the camera stream. |
| L-02 | High | 982–987 | MediaPipe is loaded with a dynamic `import()` of `vision_bundle.mjs` from `cdn.jsdelivr.net`, and its wasm from the same CDN. The version is pinned (`@0.10.14`), but a dynamic import cannot carry SRI, so nothing checks the bytes. This code receives every camera frame. |
| L-03 | Medium | 8 | Chart.js is loaded from `cdn.jsdelivr.net` (pinned `4.4.1`) with no `integrity` or `crossorigin`. |
| L-04 | Medium | 990 | The hand model is fetched from `storage.googleapis.com/mediapipe-models/...` with no hash or size check. The path is version-pinned (`float16/1`), which is good. |
| L-05 | Medium | 1103–1119 | `startCamera()` has no re-entrancy guard. It awaits the model load and then `getUserMedia`. Two fast clicks on Start (or Start then Flip) run two calls at once; both obtain a stream, the second overwrites `state.stream`, and the first stream's tracks are never stopped. The camera stays live until the page closes. |
| L-06 | Medium | 1103–1119, 1127–1138, 1242 | Same race, other outcome: click Start Camera, then Simulator while the model or the permission prompt is pending. `startDemo()` sets demo mode; the pending `startCamera()` then resumes, attaches the stream, sets `mode = 'camera'` and calls `processLoop()` a second time. The camera turns on after the user chose the simulator, and two animation loops run. |
| L-07 | Medium | whole file | There is no `visibilitychange`, `pagehide` or `beforeunload` handler (confirmed by search). The camera keeps running when the tab is hidden or the screen locks. |
| L-08 | Medium | 81–82, 1227–1233 | Switching to the R&D tab hides the Studio section but does not stop the camera. The only in-page indicator (status dot and text) lives inside the hidden section, so the camera runs with no visible indicator in the page. |
| L-09 | Medium | 1107–1111, 1120–1124 | If `getUserMedia` succeeds but `video.play()` rejects, the `catch` reports "Camera unavailable" and does not stop the stream. The camera is live while the UI says it is not. |
| L-10 | Low | 1120–1124 | One `catch` covers model download failure, permission denial, no camera, camera busy and insecure context. The error object is discarded and the user always sees "Camera blocked or unavailable". A CDN outage is reported as a camera problem, and a user who denied permission gets no guidance on how to re-enable it. |
| L-11 | Low | 1107–1110 | No handler for a track's `ended` event (camera unplugged, permission revoked in browser UI). The UI would keep showing "Camera active". |
| L-12 | Low | 9–11 | Google Fonts is loaded from `fonts.googleapis.com` / `fonts.gstatic.com` on every page load. This sends the visitor's IP address and user agent to Google before any interaction or notice. |
| L-13 | Low | 109 vs 7–11, 982–990 | The page says recognition is "on-device". Inference is local, but the page contacts five third-party hosts (`cdn.tailwindcss.com`, `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`, `storage.googleapis.com`) with no disclosure. |
| L-14 | Low | 1–36 | No Content-Security-Policy, no referrer policy, no other hardening. As a bare HTML file it has no response headers at all. |
| L-15 | Low | 1294–1303 | "Speak" passes the transcript to `speechSynthesis` with the default voice. In some browsers the default voice is a network voice, in which case the spelled text leaves the device. The prototype does not select a local voice. |
| L-16 | Low | 1279–1293 | Clipboard: write only, on a click, never read — fine. The fallback path calls the deprecated `document.execCommand('copy')` and shows "Copied!" without checking the return value, so it can report success when the copy failed. |
| L-17 | Info | 372, 425, 429, 433, 437 | External links use `target="_blank" rel="noopener"`. `noopener` is present; `noreferrer` is not. |
| L-18 | Info | 300, 486, 886–893, 1311–1317 | Custom samples live only in memory (`state.customSamples`) and are lost on reload, yet the UI counts them as "saved". Nothing limits how many are captured; each capture adds 15 vectors and the k-NN scans all of them on every frame. |

### 1.2 What is fine in the prototype (verified)

- The camera only starts from click handlers (lines 1235, 1236, 1238–1241). There is no `getUserMedia` call at load.
- Video only; no audio is requested (lines 1107–1109).
- `stopAll()` stops every track of the current stream (lines 1143–1146), and the Stop button calls it (line 1237).
- No frame leaves the page: a search for `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `toDataURL`, `toBlob`, `MediaRecorder` and `captureStream` found nothing. Frames go from the hidden `<video>` to a canvas (line 1040) and into `detectForVideo` (line 1046).
- No XSS sink: no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` or `new Function`. All dynamic text goes through `textContent` or `.value` (lines 552, 890, 910–911, 932–933, 952, 1199, 1217).
- No untrusted input source: the script does not read the URL, `postMessage`, cookies or storage.
- No `localStorage`, `sessionStorage`, IndexedDB or cookies.
- The model is fetched only after the user clicks Start Camera, not on page load.

### 1.3 What the rebuild must not carry over

1. Any script, wasm, font or stylesheet from a third-party origin at runtime (L-01, L-02, L-03, L-12).
2. A camera start path without a cancellation token (L-05, L-06) and without cleanup on every failure branch (L-09).
3. Camera lifetime tied to nothing but the Stop button (L-07, L-08, L-11).
4. A single generic camera error (L-10).

---

## 2. Threat model for the new architecture

### 2.1 Assets

| Asset | Where it lives | Why it matters |
|-------|----------------|----------------|
| Live camera frames | Browser memory only (video element, canvas, wasm heap) | Shows the user's face, home, other people. Highest sensitivity. |
| Hand landmark vectors (live) | Browser memory | Derived from the body. Less sensitive than frames; still personal data. |
| Recorded sign samples (landmark vectors) | IndexedDB / localStorage | Personal data created by the user; persists across sessions. |
| Transcripts (recognised text) | Browser memory; optionally local history | Can contain anything the user signs: names, health, messages. |
| Learning progress and settings | localStorage / IndexedDB | Low sensitivity; behavioural. |
| Feedback text and consent records | Backend database | Free text written by users; may contain personal data. |
| Model files (hand model `.task`, classifier JSON, vocabulary) | Static origin / backend / Google bucket | Integrity matters: a tampered model changes what the app says on the user's behalf. |
| Application code integrity | Frontend origin | Any script on the origin can read the camera once permission is granted. |
| Backend secrets (DB URL, admin token) | Server environment | Access to feedback data. |

### 2.2 Actors

- **User** — trusted for their own data; may share a device with others.
- **Other people in the camera's view** — have not consented to anything; reason for "no upload, no recording".
- **Other local users of the same browser profile** — can read local storage; reason for the delete-all control and for keeping transcripts out of storage by default.
- **Network attacker** — can read or alter plain-HTTP traffic.
- **Malicious or compromised third-party host** — CDN, model bucket, npm package.
- **Web attacker** — another site that tries to frame the app, call the API cross-origin, or exploit an XSS.
- **Abusive API client** — floods or probes the write endpoints.
- **Operator / developer** — has access to the backend database and logs; must not be able to see more than what users consented to send.

### 2.3 Trust boundaries

1. **Camera → page.** Crossed only after a browser permission grant. Permission is per origin, so everything on the origin shares it.
2. **Main thread ↔ web worker.** Same origin; `postMessage` payloads are landmark arrays or `ImageBitmap`/`VideoFrame`. The worker must not have network code paths for frames.
3. **Browser → frontend origin.** Static assets, wasm, self-hosted fonts. Trusted; protected by HTTPS and CSP.
4. **Browser → model host** (`storage.googleapis.com` by default). Not controlled by us. One-way download; the request reveals the user's IP address to Google.
5. **Browser → API origin.** JSON only. No frames, no landmarks unless a separate consent says so (see `BE-20`).
6. **API → database.** Parameterised access only.
7. **Build time → npm registry.** Supply chain; lock file and audit.

### 2.4 Threats and required mitigations

| # | Threat | Mitigation | Requirement |
|---|--------|------------|-------------|
| T1 | Frames or landmarks sent to a server by a bug, a dependency, or a later feature | No code path uploads frames; CSP `connect-src` allow-list; network test in CI | CAM-08, CAM-09, section 5 |
| T2 | Camera keeps running after the user thinks it stopped | Single camera controller with cancellation; stop on Stop, route change, tab hide, track end, error | CAM-03 to CAM-07 |
| T3 | Script injection (XSS) reads the camera or local samples | No `dangerouslySetInnerHTML` with untrusted data; CSP; no third-party scripts | FE-01 to FE-04, section 5 |
| T4 | Third-party asset is swapped (CDN, bucket) | Self-host wasm and fonts; pin and hash the model; prefer self-hosting the model | MOD-01 to MOD-05 |
| T5 | Malicious model or sample JSON (oversized, malformed, prototype pollution) | Origin allow-list, size cap, schema validation, no `eval` | MOD-06 to MOD-12 |
| T6 | Clickjacking to obtain a click on "Start camera" | `frame-ancestors 'none'`, `X-Frame-Options: DENY` | section 5 |
| T7 | Another origin embeds the app in an iframe and inherits camera | `Permissions-Policy: camera=(self)` | section 5 |
| T8 | Feedback endpoint spam or oversized bodies | Rate limit, body size limit, strict schema | BE-01 to BE-08 |
| T9 | Cross-origin site posts to the API using a visitor's browser | CORS allow-list from env, no credentials, JSON content type required | BE-09 to BE-11 |
| T10 | Stored XSS through feedback text in an admin view | Store as plain text; escape on output; never render as HTML | BE-05 |
| T11 | Secrets or the SQLite file committed to the repo | `.gitignore`, `.env.example` only, secret scan | BE-14 to BE-16 |
| T12 | Error responses leak stack traces or SQL | Generic error envelope; debug off in production | BE-12, BE-13 |
| T13 | Another person using the same browser reads samples or transcript history | Transcripts not persisted by default; delete-all control; clear notice of what is stored | LOC-01 to LOC-09 |
| T14 | Logs become a shadow copy of personal data | No feedback text, no full IP in application logs | BE-22 |

---

## 3. Camera privacy requirements

Each statement is testable. Suggested test method in brackets: [unit] with a mocked `navigator.mediaDevices`, [e2e] with Playwright using a fake media device, [review] by code inspection.

**Start**

- **CAM-01** `getUserMedia` MUST be called only from a handler of a user click, tap or key press on a control labelled as starting the camera. Loading or navigating to any route MUST NOT call it. [e2e: load every route with a `getUserMedia` spy; expect zero calls.]
- **CAM-02** The request MUST be `{ video: {...}, audio: false }`. The app never requests the microphone. [unit]
- **CAM-03** All camera access MUST go through one controller (hook or module). No component calls `getUserMedia` directly. [review: one call site in the codebase.]
- **CAM-04** Start MUST be cancellable. Each start attempt gets a token; if Stop, unmount, route change, tab hide or a second start happens while the model or the permission prompt is pending, the stream obtained by the stale attempt MUST be stopped immediately and never attached. [unit: resolve `getUserMedia` after stop; expect every track's `stop()` called and state `idle`.] (Fixes L-05, L-06.)
- **CAM-05** A second Start while one is pending or active MUST NOT create a second stream. [unit]

**Stop**

- **CAM-06** After any of the following, every track of every stream the app opened MUST have `readyState === 'ended'`, `video.srcObject` MUST be `null`, and the frame loop (rAF / `requestVideoFrameCallback` / worker loop) MUST be cancelled, within 500 ms:
  1. the user presses Stop;
  2. the component that owns the camera unmounts, including any client-side route change away from a camera route;
  3. `document.visibilityState` becomes `hidden`;
  4. `pagehide` fires;
  5. any error after the stream was obtained (for example `video.play()` rejects, or the landmarker throws);
  6. a track fires `ended` (device removed or permission revoked) — the remaining tracks are stopped and the UI moves to "stopped".
  [e2e for 1–4; unit for 5–6.]
- **CAM-07** Tab-hide policy: the camera stops when the tab is hidden and does NOT restart by itself when the tab becomes visible again. The UI shows "Camera paused because the tab was hidden" with a Resume button; Resume is a user gesture and follows CAM-01. [e2e]

**Indicator**

- **CAM-08** Whenever at least one track is live, a visible indicator with a text label (not colour alone) MUST be on screen in the app shell, outside any view that can be hidden, with a Stop control reachable by keyboard. It appears no later than the first processed frame and disappears only after CAM-06 completes. It is exposed to assistive technology (`role="status"` or equivalent). [e2e] (Fixes L-08.)
- **CAM-09** The indicator state MUST be derived from the actual track state, not from a separate UI flag. [review]

**No upload, no recording**

- **CAM-10** No frame, image, video, canvas export or `ImageBitmap` may be sent over the network. With the camera running for 60 s of recognition, the only requests allowed are to the app's own origin, the configured model URL (once), and JSON calls to the API origin that contain no image data. [e2e: record all requests; assert no request body above 64 KB and no `image/*`, `video/*` or `multipart/*` content type.]
- **CAM-11** The codebase MUST NOT use `MediaRecorder`, `canvas.toDataURL`, `canvas.toBlob`, `captureStream` or `ImageCapture` on camera-derived content in v1. [CI: grep check over `frontend/src`.] If a later version adds recording, it must be off by default, started by an explicit control, shown by a distinct "Recording" indicator, and stored locally only.
- **CAM-12** Recording a sign sample stores landmark vectors only (numbers). No pixels, thumbnails or raw frames are written to localStorage, IndexedDB, Cache Storage or the API. [unit: inspect the stored record's shape.]
- **CAM-13** Landmarks, transcripts and samples MUST NOT be written to `console`, analytics or error reports in production builds. [review + grep]

**Permission handling**

- **CAM-14** Before the first browser prompt the app shows a short explanation: what the camera is used for, that frames stay on the device, and that nothing is recorded. [e2e]
- **CAM-15** Errors are distinguished and each has its own message and next step (fixes L-10):
  - `NotAllowedError` / `SecurityError` — permission denied: explain how to re-enable in the browser's site settings; do not prompt in a loop.
  - `NotFoundError` / `OverconstrainedError` — no suitable camera.
  - `NotReadableError` / `AbortError` — camera in use by another application.
  - `navigator.mediaDevices` undefined — page is not in a secure context (HTTPS or localhost required).
  - Model or wasm load failure — reported as a loading problem, not a camera problem.
- **CAM-16** The app works without the camera: the learning content and a practice/simulator path remain usable after a denial. [e2e]
- **CAM-17** The app does not call `enumerateDevices()` before the user starts the camera, and never stores device IDs or labels on the server. A chosen `deviceId` may be kept locally as a setting and is covered by the delete-all control. [review]
- **CAM-18** Speech output prefers a voice with `localService === true`. If only network voices exist, the user is told that the text is sent to the browser vendor's speech service before the first use. [unit] (Fixes L-15.)

---

## 4. Frontend application requirements

- **FE-01** No runtime script, stylesheet, wasm or font from a third-party origin. MediaPipe wasm is served from `/mediapipe/wasm`; fonts through `next/font`; Tailwind is compiled at build time. [e2e: request log contains no third-party host except the model URL.]
- **FE-02** No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, or string arguments to `setTimeout`/`setInterval`. Content from the API (vocabulary, lesson text, labels) is rendered as text. If rich lesson content is ever required, it goes through a sanitiser with an allow-list and this document is updated first. [CI grep]
- **FE-03** Any URL that comes from data (lesson links, media) is checked to be `https:` or a same-origin path before it is used in `href` or `src`. External links use `rel="noopener noreferrer"`. [unit]
- **FE-04** No analytics, tag managers, session replay or error-reporting SDKs in v1. Adding one requires a privacy review and a CSP change.
- **FE-05** Only variables prefixed `NEXT_PUBLIC_` reach the browser, and they are public by definition. No secret may be placed in one. [review]
- **FE-06** Clipboard: write only, on a user gesture; never read. Report success only when the promise resolves. [unit] (Fixes L-16.)
- **FE-07** `npm audit --omit=dev` shows no high or critical issue at release; `package-lock.json` is committed and CI installs with `npm ci`.

### Third-party library defaults that break FE-01 (easy to miss)

These are present in `frontend/node_modules` today:

- `troika-three-text` 0.52.5 (used by drei's `<Text>`) contains the default URL `https://cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver@v1.0.1/packages/data` and builds its workers from `blob:` URLs. With the CSP below, the blob workers are allowed but the jsDelivr fetch is blocked. Rule: always pass a self-hosted `font` and either avoid 3D text for scripts outside that font (Devanagari and other Indic scripts included) or self-host the resolver data and set `unicodeFontsURL`. Behaviour of the fallback under a blocked fetch has not been tested yet.
- drei helpers that default to remote assets MUST be given local paths or not used: `<Environment preset=...>` (remote HDR files) and `useGLTF` with Draco/KTX2 (remote decoder). This is from library knowledge, not from reading the installed code; the implementation audit will confirm from the request log.

---

## 5. Content-Security-Policy and security headers

### 5.1 Design decisions

- **Static header, no nonce.** `next.config.ts` has `cacheComponents: true`. The Next.js CSP guide states that nonce-based CSP requires dynamic rendering and is incompatible with Partial Prerendering. A nonce would force every page to be rendered per request. The policy below therefore follows the guide's "Without Nonces" form, which needs `'unsafe-inline'` in `script-src` because the App Router emits inline bootstrap scripts.
- **Consequence, stated plainly:** with `'unsafe-inline'`, CSP does not stop an injected inline script. It still blocks third-party script hosts, `eval`, framing, plugin content, and — most important for this app — sending data to hosts outside `connect-src`. XSS prevention rests on FE-02. Removing `'unsafe-inline'` later is possible with Next's experimental `experimental.sri` (hash-based) option; it is experimental and has not been tried on this project.
- **Model host is restricted by path.** `storage.googleapis.com` hosts every public Google Cloud Storage bucket, so allowing the whole origin would let injected code send data to any bucket. The policy allows only the directory that contains the configured model file. (CSP ignores the path part after a redirect; the model URL does not redirect in normal operation.)
- **`headers()` is evaluated at build time.** `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_HAND_MODEL_URL` must be set when `next build` runs. Changing them afterwards without a rebuild leaves the old origins in the CSP and the app will fail to reach the new ones.
- **The header applies to every path**, including `/_next/static/*` and `/mediapipe/wasm/*`. A dedicated worker loaded from a URL takes its CSP from the worker script's own response, so the worker file needs the same policy to be allowed to compile wasm. Do not narrow the `source` pattern.

### 5.2 Ready-to-paste block for `frontend/next.config.ts`

Merge into the existing config; keep the existing keys (`cacheComponents`, `partialPrefetching`, `turbopack`).

```ts
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const DEFAULT_HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/** Origin of an absolute http(s) URL, or null for relative/invalid values. */
function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return /^https?:$/.test(u.protocol) ? u.origin : null;
  } catch {
    return null;
  }
}

/** Origin plus directory of an absolute http(s) URL (CSP path prefix), or null. */
function dirSourceOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.origin + u.pathname.slice(0, u.pathname.lastIndexOf("/") + 1);
  } catch {
    return null;
  }
}

const apiOrigin = originOf(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? (isDev ? "http://localhost:8000" : ""),
);
// A same-origin model path such as "/models/hand_landmarker.task" yields null and adds nothing.
const modelSource = dirSourceOf(
  process.env.NEXT_PUBLIC_HAND_MODEL_URL ?? DEFAULT_HAND_MODEL_URL,
);

const connectSrc = [
  "'self'",
  "blob:",
  apiOrigin,
  modelSource,
  // Development only: HMR websocket and a local API on any port.
  ...(isDev
    ? ["ws://localhost:*", "ws://127.0.0.1:*", "http://localhost:*", "http://127.0.0.1:*"]
    : []),
].filter((v): v is string => Boolean(v));

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-eval' is development only (React dev tooling).
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  `connect-src ${[...new Set(connectSrc)].join(" ")}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'none'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Production only: would rewrite http://localhost API calls in development.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(), geolocation=(), display-capture=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), accelerometer=(), gyroscope=(), magnetometer=(), browsing-topics=()",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Production only: never send HSTS from a development server.
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // ...existing options stay as they are...
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
```

Resulting production header with the default model URL and `NEXT_PUBLIC_API_BASE_URL=https://api.example.org/v1` (output of the builder logic, run in Node):

```
default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self' blob: https://api.example.org https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'none'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

### 5.3 Directive by directive

| Directive | Value | Why |
|-----------|-------|-----|
| `default-src` | `'self'` | Anything not listed below may only come from the app's own origin. |
| `script-src` | `'self' 'unsafe-inline' 'wasm-unsafe-eval'` | Own bundles and the self-hosted MediaPipe loader (`'self'`); Next.js inline bootstrap scripts (`'unsafe-inline'`, required without nonces); compiling the MediaPipe wasm (`'wasm-unsafe-eval'`). |
| `script-src` (dev) | adds `'unsafe-eval'` | React uses `eval` in development for debugging. Not needed and not sent in production. |
| `style-src` | `'self' 'unsafe-inline'` | Compiled CSS files plus inline `style` attributes set by React, framer-motion and the three.js canvas wrapper. |
| `img-src` | `'self' data: blob:` | Local images and icons; `data:`/`blob:` for textures and images that three.js loaders create in memory. |
| `font-src` | `'self'` | `next/font` serves fonts from `/_next/static/media`. No Google Fonts request at runtime. |
| `media-src` | `'self' blob:` | Local lesson video or audio. A camera `MediaStream` assigned to `srcObject` is not governed by this directive. |
| `connect-src` | `'self' blob: <API origin> <model directory>` | `fetch` to the app itself, the API, and the model file. `blob:` is for three.js loaders that fetch object URLs they created. Nothing else can receive data from the page. |
| `connect-src` (dev) | adds `ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*` | Hot-reload websocket and a local API on any port. |
| `worker-src` | `'self' blob:` | The recognition worker from `/_next/static`; `blob:` for workers that troika-three-text and some three.js loaders build from object URLs. |
| `child-src` | `'self' blob:` | Fallback for browsers that do not implement `worker-src`. |
| `frame-src` | `'none'` | The app embeds no iframes. |
| `manifest-src` | `'self'` | Web app manifest, if one is added. |
| `object-src` | `'none'` | No plugins. |
| `base-uri` | `'self'` | Stops an injected `<base>` tag from redirecting relative URLs. |
| `form-action` | `'self'` | Forms cannot post to another origin. |
| `frame-ancestors` | `'none'` | The app cannot be framed (clickjacking on the camera button). |
| `upgrade-insecure-requests` | production only | Rewrites stray `http:` subresource URLs to `https:`. Omitted in development so that `http://localhost` API calls are not rewritten. |

WebGL itself needs no CSP directive. Shader compilation is not `eval`.

| Header | Value | Why |
|--------|-------|-----|
| `Permissions-Policy` | `camera=(self)`, everything else listed `=()` | Only this origin's own documents can use the camera; no embedded frame can. Microphone, location, screen capture and the rest are switched off outright. |
| `X-Content-Type-Options` | `nosniff` | The browser will not reinterpret a response as script or style. |
| `X-Frame-Options` | `DENY` | Same as `frame-ancestors 'none'` for older browsers. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Other sites (and the model host) see at most the origin, never the path. |
| `Cross-Origin-Opener-Policy` | `same-origin` | A window opened from or opening the app cannot keep a handle to it. |
| `Cross-Origin-Resource-Policy` | `same-origin` | Other sites cannot embed the app's static files. Relax per path if assets are ever served to another origin. |
| `X-DNS-Prefetch-Control` | `off` | No speculative DNS lookups for link targets. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (production only) | HTTPS only for two years. Add `preload` only after deciding to submit the domain. |

Do **not** add `Cross-Origin-Embedder-Policy: require-corp`. The installed MediaPipe build shows no use of `SharedArrayBuffer`, so cross-origin isolation is not needed, and COEP would block the cross-origin model download unless that host sends matching headers.

### 5.4 Development-only relaxations (summary)

1. `'unsafe-eval'` in `script-src`.
2. `ws://localhost:*`, `ws://127.0.0.1:*`, `http://localhost:*`, `http://127.0.0.1:*` in `connect-src`.
3. No `upgrade-insecure-requests`.
4. No `Strict-Transport-Security`.

A test MUST assert that a production build's header contains none of: `'unsafe-eval'`, `localhost`, `127.0.0.1`, `ws:`.

### 5.5 What is verified and what is not

Verified:

- The "Without Nonces" shape, the development-only `'unsafe-eval'`, the need for `'wasm-unsafe-eval'` with WebAssembly, and the incompatibility of nonces with Partial Prerendering all come from the Next.js CSP guide (bundled with 16.4.6 and online).
- `@mediapipe/tasks-vision` 1.2.3 as installed: the bundle loads the wasm loader script by adding a `<script src>` on the main thread, by `importScripts` in a classic worker, and by dynamic `import()` when `importScripts` throws (module worker). All three are same-origin under `/mediapipe/wasm` and are covered by `script-src 'self'`. Neither the bundle nor the two loader files contain `eval(` or `new Function`, and none mentions `SharedArrayBuffer`.
- The builder logic was executed in Node for development, production, and a same-origin model path; output is syntactically as shown.

Not verified (to be checked in the implementation audit, in a browser, against the real app):

- That the full app runs with zero CSP violations in Chrome, Firefox and Safari, in `next dev` and in `next build && next start`. Nothing has been run in a browser.
- That Turbopack's development client needs nothing beyond the listed development sources.
- How MediaPipe fetches the model in 1.2.3 (assumed `fetch`, therefore `connect-src`), and what the two `createObjectURL` calls in the wasm loader are used for. If they create script or worker URLs, `blob:` in `worker-src` already covers workers; a `blob:` script would need a policy change.
- Whether the GPU delegate inside a worker needs anything further (it needs `OffscreenCanvas`, which is a browser capability, not a CSP matter).
- Whether Safari honours a path-restricted `connect-src` source the same way as Chromium.
- Whether `Permissions-Policy` produces console warnings for feature names a given browser does not know; this is harmless but noisy.
- If the app is deployed on a host that does not run `next start` (static export, some CDNs), `headers()` is not applied and the same headers must be configured on that host.

---

## 6. Backend requirements (FastAPI)

**Input validation**

- **BE-01** Every request body, query and path parameter is declared with a Pydantic model or typed parameter. Models use `extra="forbid"`; unknown fields return 422.
- **BE-02** Every string has a `max_length`; every list has a `max_length`; every number has bounds. Suggested limits: feedback text 2000 characters; sign label 64; locale 16; list parameters 100 items; pagination `limit` at most 100.
- **BE-03** Enumerated values (feedback category, sign ID, model ID) are validated against the server's own vocabulary, not accepted as free text.
- **BE-04** Request bodies above 64 KB are rejected with 413 before parsing. Write endpoints accept `application/json` only; other content types return 415.
- **BE-05** Feedback text is stored and returned as plain text. No endpoint returns it inside HTML. Control characters other than newline and tab are stripped.
- **BE-06** Database access uses SQLAlchemy/SQLModel bound parameters or the ORM only. No SQL built by string formatting.
- **BE-07** No endpoint accepts a file upload, an image, a video, or a base64 blob in v1. No endpoint fetches a URL supplied by the client.
- **BE-08** No endpoint accepts a filesystem path or uses client input to build one. Model and content files are served from a fixed directory by ID lookup.

**CORS**

- **BE-09** `CORSMiddleware` is configured from `CORS_ALLOW_ORIGINS` (comma-separated exact origins). The value `*` is refused at startup when `APP_ENV=production`. An empty list in production is a startup error.
- **BE-10** `allow_credentials=False` (there are no accounts or cookies). `allow_methods` is limited to the methods in use (`GET`, `POST`, `DELETE`, `OPTIONS`). `allow_headers` is limited to `Content-Type` and any custom header in use (for example `X-Deletion-Token`).
- **BE-11** CORS is not treated as access control. Write endpoints stay safe when called from curl.

**Rate limiting**

- **BE-17** Every write endpoint (`POST`, `PUT`, `PATCH`, `DELETE`) is rate limited per client IP. Suggested default: 10 requests per minute and 100 per day for feedback; configurable through env. Exceeding it returns 429 with `Retry-After`.
- **BE-18** Read endpoints have a looser limit (suggested 120 per minute) to protect a small server.
- **BE-19** Behind a reverse proxy, the client IP is taken from `X-Forwarded-For` only when `TRUSTED_PROXY_IPS` is set and the direct peer is in it. Otherwise the socket address is used. The in-memory limiter is acceptable for one process; more than one worker needs a shared store, and this must be written in the README.

**Secrets and configuration**

- **BE-14** No secret, token, password, database file or real `.env` in the repository. `.gitignore` covers `.env`, `.env.*` (except `.env.example`), `*.db`, `*.sqlite`, `*.sqlite3`.
- **BE-15** All configuration is read from the environment through one settings class. In production the app refuses to start if a required value is missing or still has its placeholder value.
- **BE-16** `/docs`, `/redoc` and `/openapi.json` are disabled when `APP_ENV=production` unless `ENABLE_DOCS=true`.

**Errors**

- **BE-12** Production responses never include stack traces, SQL, file paths or library names. Shape: `{"error": {"code": "<stable_code>", "message": "<short text>", "request_id": "<id>"}}`. Unhandled exceptions return 500 with code `internal_error`; the detail goes to the server log with the same `request_id`.
- **BE-13** Validation errors (422) list the field and the problem but do not echo the submitted value.

**Consent-managed feedback**

- **BE-20** Feedback is stored only when the request carries `consent: true` and a `consent_version` the server recognises. Otherwise 400 and nothing is written. Landmark data may be attached only under a second, separate flag (`consent_landmarks: true`); without it any landmark field is rejected. Frames or images are never accepted (BE-07).
- **BE-21** Stored per feedback item, and nothing else:

  | Field | Notes |
  |-------|-------|
  | `id` | Random UUID. |
  | `created_at` | UTC timestamp. |
  | `category` | Enumerated. |
  | `text` | Up to 2000 characters, plain text. |
  | `sign_id`, `model_id`, `app_version` | Optional context, validated against known IDs. |
  | `landmarks` | Optional, only with `consent_landmarks`; numbers only, bounded length. |
  | `consent_version` | Version of the consent text shown to the user. |
  | `consent_scopes` | For example `["feedback_text"]` or `["feedback_text", "landmarks"]`. |
  | `consent_given_at` | UTC timestamp. |
  | `deletion_token_hash` | SHA-256 of a random 32-byte token; the token itself is returned once in the response and never stored. |
  | `expires_at` | `created_at` plus the retention period. |

  Not stored: IP address, user agent, cookies, device identifiers, precise location, name, email. If a contact field is ever added it needs its own consent scope and this table is updated first.
- **BE-22** Application logs record method, path, status, duration and `request_id`. They do not record request bodies, feedback text, landmarks or deletion tokens. If the proxy logs IP addresses, proxy logs are kept at most 14 days.
- **BE-23** Retention: feedback is deleted after `FEEDBACK_RETENTION_DAYS` (default 365). A purge runs at startup and at least daily and removes rows past `expires_at`. Deletion is a real `DELETE`, not a flag. The exact consent text for each `consent_version` is kept in the repository so that a stored record can be matched to what the user saw.
- **BE-24** Deletion by the user: `DELETE /feedback/{id}` with the deletion token removes the row and returns 204. A wrong token and an unknown ID both return 404 (no way to probe which IDs exist). The frontend keeps the `(id, token)` pairs locally and offers "Delete the feedback I sent" in the privacy settings. The delete-all control (LOC-06) offers to do this first, because wiping local data destroys the tokens.
- **BE-25** Any endpoint that lists or exports feedback is for operators only and requires `ADMIN_TOKEN` (compared in constant time). It is not reachable without it, and it is off entirely when `ADMIN_TOKEN` is unset.
- **BE-26** The SQLite file lives outside any served directory, with permissions restricted to the service user. Backups follow the same retention period.

RTSLR is aimed at users in India, so the Digital Personal Data Protection Act, 2023 is the likely governing law for the feedback data: notice in plain language, consent that can be withdrawn as easily as it was given, and deletion when the purpose is served. The requirements above are designed with that in mind; they are not a legal review.

### 6.1 `backend/.env.example`

```dotenv
# Copy to .env and fill in. Never commit .env.

# development | production
APP_ENV=development

# SQLite by default. PostgreSQL example:
#   postgresql+psycopg://rtslr:CHANGE_ME@localhost:5432/rtslr
DATABASE_URL=sqlite:///./data/rtslr.db

# Comma-separated exact origins allowed to call the API. No wildcard in production.
CORS_ALLOW_ORIGINS=http://localhost:3000

# Rate limits for write endpoints (per client IP).
RATE_LIMIT_WRITE_PER_MINUTE=10
RATE_LIMIT_WRITE_PER_DAY=100
RATE_LIMIT_READ_PER_MINUTE=120

# Comma-separated proxy IPs whose X-Forwarded-For is trusted. Empty = use the socket address.
TRUSTED_PROXY_IPS=

# Feedback retention in days; rows older than this are deleted.
FEEDBACK_RETENTION_DAYS=365

# Consent text version the API currently accepts.
CONSENT_VERSION=1

# Maximum accepted request body in bytes.
MAX_BODY_BYTES=65536

# Operator token for feedback export. Empty = export endpoints disabled.
# Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
ADMIN_TOKEN=

# Serve /docs and /openapi.json in production (default off).
ENABLE_DOCS=false

LOG_LEVEL=info
```

### 6.2 `frontend/.env.example`

```dotenv
# Everything prefixed NEXT_PUBLIC_ is embedded in the browser bundle and is public.
# Never put a secret here. These values are read at build time and also define the CSP.

# Base URL of the FastAPI backend.
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Hand landmarker model. Default is Google's public MediaPipe bucket.
# For production, prefer a self-hosted copy: /models/hand_landmarker.task
NEXT_PUBLIC_HAND_MODEL_URL=https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

# Optional: lowercase hex SHA-256 of the model file. When set, the app refuses a file that does not match.
NEXT_PUBLIC_HAND_MODEL_SHA256=
```

`NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_HAND_MODEL_SHA256` are names proposed here. If the frontend agents chose different names, the CSP block in 5.2 must be changed to read theirs.

---

## 7. Safe model-file handling

Two kinds of file are in scope: the MediaPipe hand model (binary `.task`) and JSON files the app parses itself (classifier weights or prototypes, vocabulary, label maps, and any user import of samples).

**Where files may come from**

- **MOD-01** A model or data file is loaded only from (a) the app's own origin, (b) the configured API origin, or (c) the exact URL in `NEXT_PUBLIC_HAND_MODEL_URL`. The check is on the parsed URL (`new URL(...)`: protocol `https:` — or `http:` for localhost in development — plus origin and path prefix), not on a substring match. [unit]
- **MOD-02** A model URL is never taken from a query string, hash, `postMessage`, localStorage, or an API response field. API responses may carry a model ID; the frontend maps the ID to a URL it builds itself. [review]
- **MOD-03** Fetches for model files use `credentials: "omit"` and `redirect: "error"`, and the response must be `ok`. [unit]
- **MOD-04** MediaPipe wasm and its loader script are served only from `/mediapipe/wasm`, copied from `node_modules/@mediapipe/tasks-vision/wasm` at build time so the version matches `package-lock.json`. They are not committed by hand from another source.
- **MOD-05** Production should self-host the hand model under `/models/` and set `NEXT_PUBLIC_HAND_MODEL_SHA256`. This removes the only runtime third-party request and lets the CSP `connect-src` drop the Google bucket. If the Google URL is kept, the privacy notice must say that the model download reveals the user's IP address to Google.

**Validation before use**

- **MOD-06** Size cap enforced before and during download: reject when `Content-Length` exceeds the cap, and abort the stream when the bytes read exceed it. Caps: 25 MB for the hand model, 5 MB for any JSON model, 1 MB for vocabulary or label files, 5 MB for a user-imported samples file. [unit]
- **MOD-07** When a SHA-256 is configured, the downloaded bytes are hashed with `crypto.subtle.digest` and compared before the file is handed to MediaPipe (pass the verified bytes as `modelAssetBuffer` rather than letting MediaPipe fetch the URL a second time). A mismatch is a hard failure with a clear message. [unit]
- **MOD-08** JSON is parsed with `JSON.parse` (or `response.json()`) only. No `eval`, `new Function`, `import()` of a data URL, or script-tag loading of data. [CI grep]
- **MOD-09** Parsed JSON is validated against a schema (zod is already installed) before any value is used: expected `format`/`version` field; label array length within a bound (at most 2000) and each label a string of at most 64 characters; vector dimensions equal to the dimension the code expects (63 or 126); every number passes `Number.isFinite`; array lengths consistent between weights, labels and shapes; total element count within a bound. Unknown top-level keys are rejected. [unit with malformed fixtures]
- **MOD-10** Keys from a file are never used to index plain objects that have a prototype. Use `Map` or `Object.create(null)`, and reject the keys `__proto__`, `constructor` and `prototype`. [unit]
- **MOD-11** Labels and descriptions from a model or vocabulary file are rendered as text only (FE-02).
- **MOD-12** A file that fails any check is not partly applied: the previously working model stays active, and the user sees which file failed and why. The same validation applies to samples read back from IndexedDB/localStorage and to any file the user imports, because local storage can be edited by anyone with access to the browser. [unit]
- **MOD-13** Numeric weights go into typed arrays. The app does not accept model formats that contain code or operator names resolved to functions by string lookup without an allow-list.

---

## 8. Local data: retention and deletion

### 8.1 Inventory

All keys and database names use the prefix `rtslr` so that they can be found and removed as a group. The exact names are the frontend's choice, but the list must be kept in one module (`storage registry`) that the delete-all control reads.

| Data | Storage | Default | Retention |
|------|---------|---------|-----------|
| Recorded sign samples (landmark vectors, label, timestamp, schema version) | IndexedDB | Created only when the user records | Until the user deletes them. Cap: 200 samples per sign and 20 MB total; at the cap the user is asked to delete before recording more. |
| Learning progress (lesson state, scores, streaks) | localStorage or IndexedDB | On | Until the user deletes it. |
| Settings (thresholds, mirror, camera choice, theme) | localStorage | On | Until the user deletes it. |
| Live transcript | Memory only | On | Gone on reload or tab close. Not written to storage. |
| Transcript history | IndexedDB | **Off**; opt-in switch | When on: at most 50 entries and at most 30 days; older entries are removed at app start. Turning the switch off deletes the history. |
| Feedback receipts (`id`, deletion token, date) | localStorage | Created when feedback is sent | Removed when the feedback is deleted, or after the server retention period. |
| Consent choices (version, date) | localStorage | Created on first choice | Until the user deletes them. |
| Cached model files | HTTP cache / Cache Storage | Browser-managed | Not personal data; removed by the delete-all control when held in Cache Storage. |

### 8.2 Requirements

- **LOC-01** Nothing personal is written to storage before the user takes an action that implies it (recording a sample, completing a lesson, changing a setting, opting in to history). First load of the app creates no entries apart from non-personal defaults. [e2e]
- **LOC-02** No camera frame, image or thumbnail is ever stored (CAM-12).
- **LOC-03** Local data is never sent to the API, except what the user submits through the feedback form under BE-20. There is no background sync in v1.
- **LOC-04** No cookies. No `sessionStorage` for personal data.
- **LOC-05** A "Your data" page shows, in plain language, each category from the table with its current size or count, and a delete button per category (samples for one sign, all samples, progress, transcript history, settings).
- **LOC-06** A **"Delete all my local data"** control is reachable from that page and from the footer or settings in at most two steps. After one confirmation step it MUST:
  1. stop the camera (CAM-06) and terminate recognition workers;
  2. offer to delete feedback already sent (BE-24) while the tokens still exist;
  3. remove every `rtslr`-prefixed key from `localStorage` and `sessionStorage`;
  4. delete every IndexedDB database the app created (close open connections first; handle the `blocked` event by asking the user to close other tabs of the app);
  5. delete the app's Cache Storage entries and unregister any service worker;
  6. reset in-memory state (transcript, loaded samples, k-NN index) so that nothing is written back;
  7. show a confirmation that lists what was removed, without needing a network connection.
  [e2e: seed all stores, trigger the control, assert `localStorage.length === 0` for the prefix, `indexedDB.databases()` contains no app database, and the transcript view is empty.]
- **LOC-07** Deletion works offline and with the API unreachable.
- **LOC-08** Export: the user can download their samples and progress as a JSON file (created locally with a `blob:` URL). Import goes through MOD-06, MOD-08 to MOD-12.
- **LOC-09** Stored records carry a schema version. On an unknown or invalid version the app does not crash and does not silently discard: it tells the user and offers export-as-is or delete.
- **LOC-10** The privacy notice states that local data sits unencrypted in the browser profile and can be read by anyone who uses that profile, and that clearing site data in the browser has the same effect as the delete-all control.

---

## 9. Deployment security checklist

**Transport and hosting**

- [ ] HTTPS only for the frontend and the API; HTTP redirects to HTTPS. The camera does not work on plain HTTP outside localhost.
- [ ] TLS 1.2 or newer; certificate renewal automated.
- [ ] The headers from section 5 are present on the HTML document, on `/_next/static/*` and on `/mediapipe/wasm/*` (check with `curl -I` on each).
- [ ] The production CSP contains no `'unsafe-eval'`, no `localhost`, no `ws:`.
- [ ] `.wasm` files are served with `Content-Type: application/wasm`.
- [ ] If the host is not `next start`, the same headers are configured at the host or CDN.

**Build**

- [ ] `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_HAND_MODEL_URL` are set at build time and the built CSP shows the expected origins.
- [ ] `npm ci` from the committed lock file; `npm audit --omit=dev` has no high or critical finding.
- [ ] Python dependencies pinned; `pip-audit` has no high or critical finding.
- [ ] `/mediapipe/wasm` was copied from the installed package version, not from a CDN.
- [ ] Production source maps are not public, or contain nothing beyond the open code.
- [ ] No third-party host appears in the production request log except the model URL (none when self-hosted).

**Backend**

- [ ] `APP_ENV=production`; debug and auto-reload off; API docs off unless intended.
- [ ] `CORS_ALLOW_ORIGINS` lists the real frontend origin(s) only.
- [ ] Rate limits active and verified with a burst test (429 with `Retry-After`).
- [ ] The API process runs as a non-root user; the database file or credentials are readable by that user only.
- [ ] Secrets come from the platform's secret store or environment, not from files in the image or repository.
- [ ] A secret scan of the repository history (for example gitleaks) is clean; `.env`, `*.db` and `*.sqlite*` are ignored.
- [ ] Error responses checked: a forced 500 returns the generic envelope with no stack trace.
- [ ] The retention purge has run at least once and removed a test row past its expiry.
- [ ] Logs contain no feedback text, landmarks or deletion tokens; proxy log retention is 14 days or less.
- [ ] Database backups are encrypted and expire within the feedback retention period.

**Privacy**

- [ ] A privacy notice is published that matches this document: camera use, on-device processing, no recording, what is stored locally, what feedback stores, retention, how to delete, and the model download host.
- [ ] The consent text for the current `CONSENT_VERSION` is in the repository and matches what the UI shows.
- [ ] Camera tests CAM-01 to CAM-12 pass on the production build in Chrome, Firefox, Safari (macOS and iOS) and Chrome on Android.
- [ ] The delete-all control (LOC-06) passes its end-to-end test on the production build.
- [ ] No analytics or error-reporting SDK is present (FE-04).

**After release**

- [ ] A contact address for security reports is published (`/.well-known/security.txt`).
- [ ] Dependency updates are reviewed at least monthly; a MediaPipe update re-runs the CSP checks in 5.5.
