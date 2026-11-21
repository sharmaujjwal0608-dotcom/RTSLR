# RTSLR — common brief for every agent

Read this first. Then read the contract docs named in your task.

## Product

RTSLR (Real-Time Sign Language Recognition) is a multi-page web platform for **Indian Sign Language (ISL)**:
a marketing site, a camera-based recognition studio, an ISL learning area and an R&D area.

- Project root: `C:\Users\OIZOM\Desktop\paytm\RTSLR`
- Legacy prototype to learn from (read-only, never edit): `C:\Users\OIZOM\Desktop\paytm\basic version.html`.
  It is an **ASL** fingerspelling demo, not ISL.

## Stack (installed and verified — do not add or upgrade packages)

- `frontend/`: Next.js **16.4.6** App Router, React 19.3, TypeScript strict, Tailwind CSS **4.3** (CSS-first config in `src/app/globals.css`, no `tailwind.config.js`), `motion` 14 (import from `motion/react`), `lucide-react`, `three` 0.187 + `@react-three/fiber` 9 + `@react-three/drei` 10, `@mediapipe/tasks-vision` 1.2.3, Vitest 5 + Testing Library, Playwright.
- **Next.js 16 differs from older versions.** `frontend/AGENTS.md` says so; read the relevant guide under `frontend/node_modules/next/dist/docs/` before using any Next API you are not certain about. `cacheComponents: true` is on.
- `backend/`: Python 3.12 venv at `backend/.venv` with FastAPI 0.165, Pydantic 2.14, pydantic-settings, SQLAlchemy 2.1, Alembic 1.20, pytest, httpx.
- `machine-learning/`: Python 3.12 venv at `machine-learning/.venv` with NumPy 2.5, scikit-learn 1.9, SciPy, pytest. PyTorch, OpenCV and MediaPipe-Python are **not** installed.
- If you believe a new package is essential, do not install it: say so in your report.

## Working rules

1. **Stay inside your owned paths.** Other agents are editing the same repository at the same time. Never edit, move or reformat files you do not own. If you need a change elsewhere, describe it under INTEGRATION NOTES.
2. Do not run `next build`, `next dev`, `npm install` or `pip install`: they collide with other agents. To check your TypeScript use `npx tsc --noEmit -p .` from `frontend/` and look only at errors in your own files (other agents' files may be mid-edit). You may run `npx vitest run <your test files>` and `npx eslint <your files>`.
3. Do not commit, branch or run git commands that change state.
4. Shared contracts are fixed: `frontend/src/types/recognition.ts`, `docs/MODEL_CONTRACTS.md`, `docs/API_CONTRACTS.md`, `frontend/src/i18n/index.tsx`. Code against them; do not modify them.
5. Shell: Windows. PowerShell and Git Bash are both available.

## Honesty rules (these override any wish to make things look finished)

- No trained or validated ISL model exists. Never present the legacy ASL classifier, the simulator or user-recorded templates as validated ISL recognition.
- Never invent accuracy, latency, user or dataset numbers. Never invent test results. If you did not run it, say "not run".
- Do not describe or depict how an ISL sign is formed unless it comes from a cited authoritative source. Unknown is better than wrong; mark media as "pending verified source".
- No placeholder buttons or dead links: every control does something real or is not rendered.
- Do not claim suitability for medical, legal, emergency or other high-stakes communication.

## Security and privacy rules (from docs/SECURITY_PRIVACY.md)

- Camera starts only from a user gesture; frames never leave the browser; never use `MediaRecorder`, `toDataURL`, `toBlob`, `captureStream` or `ImageCapture` on camera content.
- No `dangerouslySetInnerHTML`, `innerHTML` or `eval`.
- No third-party runtime requests: no CDN scripts, no drei `<Environment preset>`, no drei `<Text>` (it fetches from jsDelivr), no remote fonts outside `next/font`.
- Browser storage keys and IndexedDB names start with `rtslr`.

## Interface language

Interface text is English and Hindi through `frontend/src/i18n/index.tsx`:

```tsx
"use client";
import { defineMessages, useMessages } from "@/i18n";
const messages = defineMessages({ en: { title: "…" }, hi: { title: "…" } });
const t = useMessages(messages);
```

Keep messages next to the component that uses them. Write natural Hindi in Devanagari; keep the product name "RTSLR" and the abbreviation "ISL" in Latin letters.

## Accessibility baseline

Semantic HTML, one `<h1>` per page, labelled controls, visible focus, keyboard operable, status changes announced with `aria-live`, no information by colour alone, and all motion disabled under `prefers-reduced-motion`.

## Report

When finished, write `docs/agent-reports/AGENT_NN.md` with exactly these fields, then send the orchestrator a short summary:

```
AGENT:
ASSIGNED TASK:
OWNED FILES:
DEPENDENCIES:
IMPLEMENTED FEATURES:
FILES CREATED OR MODIFIED:
TESTS RUN:
TEST RESULTS:
KNOWN LIMITATIONS:
INTEGRATION NOTES:
STATUS:   (NOT STARTED | IN PROGRESS | BLOCKED | READY FOR REVIEW | TESTED | INTEGRATED)
```

Use TESTED only if you executed tests and they passed. Paste real command output summaries, not expectations.
