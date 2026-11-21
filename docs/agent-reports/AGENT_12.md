# AGENT 12 REPORT

## AGENT

Agent 12 — Security and Privacy Engineer

## ASSIGNED TASK

Pass 1: audit the legacy prototype (`C:\Users\OIZOM\Desktop\paytm\basic version.html`) and write the security and privacy requirements for the RTSLR rebuild: threat model, camera privacy requirements, Content-Security-Policy and security headers for Next.js, backend requirements, safe model-file handling, local data retention and deletion, deployment checklist. An implementation audit is expected later.

## OWNED FILES

- `RTSLR\docs\SECURITY_PRIVACY.md`
- `RTSLR\docs\agent-reports\AGENT_12.md`

## DEPENDENCIES

- Frontend agents: must apply the `headers()` block from section 5.2 in `frontend/next.config.ts`, implement the camera controller (CAM-01 to CAM-18), the storage registry and the delete-all control (LOC-01 to LOC-10), and model loading (MOD-01 to MOD-13).
- Backend agent: must implement BE-01 to BE-26 and ship `backend/.env.example` as given in section 6.1.
- Environment variable names: the CSP block reads `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_HAND_MODEL_URL`. `NEXT_PUBLIC_HAND_MODEL_URL` was given in the brief; `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_HAND_MODEL_SHA256` are names proposed by this agent and need to be agreed with the frontend agents.
- `RTSLR\backend` did not exist when this pass was written.

## IMPLEMENTED FEATURES

Documentation only; no application code.

- Legacy audit: 18 findings with line references, plus a list of what the prototype does correctly.
- Threat model: assets, actors, trust boundaries, 14 threats mapped to requirement IDs.
- Camera privacy requirements CAM-01 to CAM-18, each with a suggested test method.
- Frontend requirements FE-01 to FE-07, including third-party library defaults that would break the policy.
- CSP and security headers as a `headers()` block for `next.config.ts`, with per-directive explanations, development-only relaxations, and a verified / not-verified list.
- Backend requirements BE-01 to BE-26, including the consent record, retention and deletion design, and `.env.example` contents for backend and frontend.
- Model-file handling requirements MOD-01 to MOD-13.
- Local data inventory, retention rules and the delete-all control specification.
- Deployment security checklist.

## FILES CREATED OR MODIFIED

- Created `RTSLR\docs\SECURITY_PRIVACY.md`
- Created `RTSLR\docs\agent-reports\AGENT_12.md`
- Nothing under `RTSLR\frontend` or `RTSLR\backend` was modified. The frontend scaffold and `node_modules` were read only.

## TESTS RUN

1. Full read of `basic version.html` (1320 lines) and a case-insensitive search of it for: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function`, `localStorage`, `sessionStorage`, `indexedDB`, `cookie`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `toDataURL`, `toBlob`, `MediaRecorder`, `captureStream`, `visibilitychange`, `pagehide`, `beforeunload`, `postMessage`, `integrity=`, `Content-Security-Policy`, `referrer`, `audio`.
2. The CSP builder logic from section 5.2 was run as a plain Node script (outside the project, in a scratch directory) with `NODE_ENV=development`, with `NODE_ENV=production` plus an API URL, and with a same-origin and a non-http model path.
3. Static inspection of installed packages: `@mediapipe/tasks-vision` 1.2.3 (bundle and both wasm loader scripts) and `troika-three-text` 0.52.5, by text search for `eval(`, `new Function`, `importScripts`, `SharedArrayBuffer`, `createObjectURL`, and hard-coded URLs.
4. Documentation check: Next.js CSP guide, both the copy bundled with Next 16.4.6 and the online page.

No browser test, no Next.js build, no backend test and no automated test suite was run.

## TEST RESULTS

1. The search matched only line 10 (`crossorigin` on the fonts preconnect). So the prototype has no HTML-injection sink, no storage, no network call from script other than the MediaPipe import and model load, no frame export, and no page-lifecycle handler. Findings L-01 to L-18 follow from the read.
2. The builder produced a well-formed policy in each case. The first run exposed a defect in my own draft: a non-http value produced the source `null/...`. A scheme check was added and the re-run gave the expected output (model source omitted for non-http and same-origin values). The production output is quoted in section 5.2.
3. MediaPipe 1.2.3: no `eval(`, `new Function` or `SharedArrayBuffer` in the bundle or loaders; loader script is loaded by `<script src>`, `importScripts`, or dynamic `import()` fallback. troika-three-text contains a default jsDelivr URL for font fallback data and builds workers from object URLs.
4. The Next.js guide confirms: the non-nonce policy form with `'unsafe-inline'`, `'unsafe-eval'` in development only, `'wasm-unsafe-eval'` for WebAssembly, and that nonces are incompatible with Partial Prerendering.

## KNOWN LIMITATIONS

- The CSP has not been exercised in any browser, in `next dev` or in a production build. Section 5.5 lists each unverified point.
- `script-src` contains `'unsafe-inline'`. This is required by Next.js without nonces, and nonces conflict with `cacheComponents: true`. CSP therefore does not block injected inline script; it limits script hosts, `eval`, framing and where data can be sent.
- How MediaPipe 1.2.3 downloads the model (assumed `fetch`) and the purpose of `createObjectURL` in its wasm loader were not traced.
- Statements about drei's `<Environment>` presets and Draco/KTX2 decoder defaults come from library knowledge, not from reading the installed code.
- The behaviour of troika-three-text when its font-fallback fetch is blocked was not tested.
- Rate-limit numbers, size caps and retention periods are proposed defaults, not measured values.
- The note on the Digital Personal Data Protection Act, 2023 is a design consideration, not legal advice.
- The backend did not exist, so nothing about it was audited.

## INTEGRATION NOTES

1. Paste the block from `SECURITY_PRIVACY.md` section 5.2 into `frontend/next.config.ts`, keeping the existing `cacheComponents`, `partialPrefetching` and `turbopack` keys. Keep `source: "/(.*)"`; the worker script and the wasm directory need the same headers as the pages.
2. The CSP is computed at build time from `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_HAND_MODEL_URL`. If the frontend uses another name for the API URL, change the block. Changing either value needs a rebuild.
3. The model host is allowed by directory path, not by origin. A model URL in a different directory or bucket will be blocked until the env value is changed and the app rebuilt.
4. No runtime request to any third-party host other than the model URL. This rules out drei `<Text>` without a self-hosted font (and without self-hosted fallback data for Devanagari), `<Environment preset>`, remote Draco/KTX2 decoders, Google Fonts links, and any CDN script.
5. One camera controller only, with a cancellation token for start, and stop on: Stop, unmount/route change, tab hidden, `pagehide`, track `ended`, and any error after the stream exists. No automatic restart when the tab becomes visible.
6. The camera indicator belongs in the app shell (layout), not inside the camera view.
7. Samples are landmark numbers only. No `toDataURL`, `toBlob`, `MediaRecorder`, `captureStream`.
8. All storage keys and database names start with `rtslr` and are listed in one registry module that the delete-all control uses.
9. Backend: CORS origins from `CORS_ALLOW_ORIGINS` with no wildcard in production; rate limit on every write endpoint; feedback rejected without `consent: true` and a known `consent_version`; no IP address or user agent stored with feedback; deletion by `id` plus a one-time token.
10. Do not add `Cross-Origin-Embedder-Policy`; it would block the cross-origin model download.

## STATUS

READY FOR REVIEW
